# Real-Time Collaboration Socket Architecture

## Problem Summary (Fixed)

### 1. **Real-time sync not working (elements not propagating)**
**Root Cause**: The Redis pub/sub message handler in `server/socket/socket.js` had a regex that only matched numeric room IDs:
```javascript
// BROKEN - only matches numeric IDs
const match = channel.match(/^room:(\d+):events$/);
```
But rooms use UUIDs (e.g., `room:550e8400-e29b-41d4-a716-446655440000:events`). The regex failed, dropping all cross-instance events silently.

**Fix**: Changed regex to match any room ID:
```javascript
// FIXED - matches UUIDs and numeric IDs
const match = channel.match(/^room:(.+):events$/);
```

### 2. **Room list showing ALL rooms from DB (not user-associated)**
**Root Cause**: `server/lib/db.js` `listRooms()` returned all rooms regardless of user.

**Fix**: Added `listRoomsForUser(userId)` that returns rooms where:
- User is the owner (`rooms.created_by = userId`), OR
- User has participated (has messages in `chat_messages` for that room)

### 3. **Room list scrolling broken (fixed height + overflow)**
**Root Cause**: Room list rendered without scroll container or max-height.

**Fix**: Added scrollable container in `RoomsPage.tsx`:
```tsx
<div className="max-h-96 overflow-y-auto space-y-3 pr-1">
  {rooms.map(...)}
</div>
```

---

## Architecture Overview

### Client → Server Event Flow

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           MULTI-INSTANCE CLUSTER                        │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐                │
│  │  Instance 1 │    │  Instance 2 │    │  Instance 3 │   ... x8      │
│  │             │    │             │    │             │                │
│  │  Socket.IO  │    │  Socket.IO  │    │  Socket.IO  │                │
│  │   Server    │    │   Server    │    │   Server    │                │
│  └──────┬──────┘    └──────┬──────┘    └──────┬──────┘                │
│         │                  │                  │                        │
│         └──────────────────┼──────────────────┘                        │
│                            ▼                                           │
│                   ┌─────────────────┐                                  │
│                   │   Redis Pub/Sub │                                  │
│                   │  room:*:events  │                                  │
│                   │  room:*:presence│                                  │
│                   │  room:*:owner-  │                                  │
│                   │      notify     │                                  │
│                   └─────────────────┘                                  │
└─────────────────────────────────────────────────────────────────────────┘
```

### Event Types

| Direction | Event | Payload | Description |
|-----------|-------|---------|-------------|
| C→S | `element-create` | `Element` | New element drawn |
| C→S | `element-update` | `Element` | Element moved/resized |
| C→S | `element-delete` | `elementId` | Element deleted |
| C→S | `board-state` | `Element[]` | Full board replace (templates) |
| C→S | `chat-message` | `{message}` | Chat message |
| C→S | `join-response` | `{socketId, accept}` | Owner approves join request |
| S→C | `init-state` | `Element[]` | Full board on join |
| S→C | `element-created` | `Element` | Broadcast: new element |
| S→C | `element-updated` | `Element` | Broadcast: element changed |
| S→C | `element-deleted` | `elementId` | Broadcast: element removed |
| S→C | `board-state` | `Element[]` | Broadcast: full board sync |
| S→C | `chat-message` | `Message` | Broadcast: new chat |
| S→C | `presence` | `{count}` | Peer count update |
| S→C | `join-request` | `{socketId, user}` | Owner: user waiting |
| S→C | `join-accepted` | — | User approved |
| S→C | `join-rejected` | — | User denied |
| S→C | `error` | `{code, message}` | Terminal errors |

---

## Key Implementation Details

### Server (`server/socket/socket.js`)

**Room State Persistence Pattern:**
```javascript
socket.on('element-create', async (newElement) => {
  // 1. Load current state from local cache (or DB)
  const existing = (await getRoomState(roomId)) || [];
  
  // 2. Apply change locally
  const updated = [...existing, newElement];
  await persistRoomState(roomId, updated);  // Updates local cache + DB
  
  // 3. Publish to Redis for cross-instance broadcast
  await pubClient.publish(`room:${roomKey}:events`, JSON.stringify({
    event: 'element-created',
    data: newElement,
    senderSocketId: socket.id,  // CRITICAL: exclude sender
  }));
});
```

**Redis Pub/Sub Handler (Cross-Instance Forwarding):**
```javascript
subClient.on('pmessage', async (pattern, channel, message) => {
  if (channel.includes(':events')) {
    // Extract roomKey from UUID channel: room:uuid:events
    const match = channel.match(/^room:(.+):events$/);
    const roomKey = String(match[1]);
    
    const { event, data, senderSocketId } = JSON.parse(message);
    
    // Emit to ALL sockets in room EXCEPT the sender
    if (senderSocketId) {
      io.to(roomKey).except(senderSocketId).emit(event, data);
    } else {
      io.to(roomKey).emit(event, data);
    }
  }
});
```

### Client (`client/src/hooks/useSocket.ts`)

**Incremental Updates (not full state):**
```typescript
const { createElement, updateElement, deleteElement, sendChat } = useSocket(
  url, roomId, token,
  onElementsUpdate,      // Applies all incoming events
  onMessagesUpdate,      // Chat
  onJoinRequest
);

// Use in components:
// Drawing:     createElement(newEl)
// Moving:      updateElement(movedEl)  
// Deleting:    deleteElement(id)
// Chat:        sendChat("hello")
```

**Auto De-duplication:**
```typescript
socket.on("element-created", (newElement: Element) => {
  onElementsUpdate((prev: Element[]) => {
    if (prev.some(el => el.id === newElement.id)) return prev; // ignore dup
    return [...prev, newElement];
  });
});
```

---

## Debugging Checklist

### If real-time still not working:

1. **Check Redis connection**:
   ```bash
   # Server logs should show:
   🟢 [inst-xxx] Redis publisher ready
   🟢 [inst-xxx] Redis subscriber ready
   🟢 [inst-xxx] Socket.IO Redis adapter configured
   🟢 [inst-xxx] Subscribed to room:*:events + room-level channels
   ```

2. **Verify channel subscription**:
   ```bash
   # In Redis CLI:
   PUBSUB CHANNELS room:*
   # Should show: room:uuid:events, room:uuid:presence, room:uuid:owner-notify
   ```

3. **Check server event logs**:
   ```
   [inst-xxx → Room uuid] Forwarded event: element-created
   ```

4. **Client should log**:
   ```
   🔌 [socket] connecting to ws://localhost:8000 roomId=uuid
   ✅ [socket] connected: socketId
   📦 [socket] init-state: N elements
   ```

5. **Verify sender exclusion works** - the user who creates an element should NOT receive `element-created` back (already has it locally).

---

## Common Pitfalls

| Issue | Cause | Fix |
|-------|-------|-----|
| Elements appear after reload only | Regex didn't match UUID | Fixed: `/^room:(.+):events$/` |
| All users see same room list | `listRooms()` lacked user filter | Use `listRoomsForUser(userId)` |
| Room list overflow | No max-height/overflow | Added `max-h-96 overflow-y-auto` |
| Duplicate elements on reconnect | No de-dupe on `init-state` + `element-created` | Check `el.id` before push |
| Peer count wrong | Presence not cross-instance | Uses Redis `owner-notify` + local adapter |

---

## File Map

```
server/
├── socket/socket.js        # Main socket handler (FIXED regex)
├── lib/
│   ├── redis.js            # Redis pub/sub clients
│   ├── db.js               # DB queries (ADDED listRoomsForUser)
│   └── roomState.js        # Room owner/presence Redis ops
├── controllers/
│   └── roomsController.js  # CHANGED to use listRoomsForUser
└── routes/rooms.js         # Unchanged

client/src/
├── hooks/useSocket.ts      # Rewritten: incremental API
├── components/
│   ├── RoomsPage.tsx       # User-filtered + scrollable
│   └── App.tsx             # Uses createElement/updateElement
└── lib/api.ts              # Unchanged
```

---

## Test Steps

1. **Start server**: `cd server && npm run dev`
2. **Open 2 browser windows** (incognito for 2nd user)
3. **Login as different users**
4. **User A**: Create room "Test"
5. **User B**: Should see "Test" in room list (if owner or participant)
6. **Both join**: Draw shapes in User A
7. **Verify**: Shapes appear instantly in User B (no reload)
8. **Move shape**: Verify instant sync
9. **Delete shape**: Verify instant removal
10. **Chat**: Verify messages sync