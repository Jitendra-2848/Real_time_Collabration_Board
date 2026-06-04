Test folder

This folder contains integration and load testing utilities for the realtime collaboration server.

Setup

1. Install test dependencies

```bash
cd test
npm install
```

2. Ensure server and Redis are running and reachable. Set environment variables if needed:
- `SERVER_URL` (default: http://localhost:8000)
- `JWT_SECRET` (default: realtime-collab-secret)

Integration test

Runs a small owner+guest flow that creates two users, a room, connects sockets, approves the guest, and sends a chat message.

```bash
node integration-test.js
```

Load test (clustered)

The `load-test-cluster.js` script spawns multiple Node worker processes to simulate many concurrent browsers.

Example: 10k clients across 8 workers, run for 60s

```bash
# from repo root
cd test
node load-test-cluster.js --clients=10000 --workers=8 --roomId=1 --rate=2000 --duration=60
```

Options
- `--clients` total clients to create (default 10000)
- `--workers` worker processes (default: number of CPUs)
- `--roomId` room to connect to (must exist)
- `--rate` connection rate (connections per second across cluster)
- `--duration` how many seconds to keep connections before teardown

Notes and troubleshooting
- On Linux, increase file descriptor limit before running a large test:
  ```bash
  sudo sysctl -w fs.file-max=200000
  ulimit -n 200000
  ```
- On Windows, adjust TCP ephemeral port settings and watch system limits.
- Make sure server `JWT_SECRET` matches the one used by the test runner (or set `JWT_SECRET` env var).

Collecting results
- The clustered script prints aggregated JSON to stdout once workers finish. Save this output to a file for analysis.

Example run automation
- You can wrap the test invocation in a loop to run multiple iterations and collect metrics into a CSV/JSON file for trend analysis.

Safety
- Running thousands of connections consumes significant CPU and memory and can disrupt local networks — prefer a dedicated test VM or cloud instance for large tests.

If you want, I can:
- Add a script that runs N iterations and writes summarized CSV/JSON results.
- Implement an in-app UI for pending join approvals (owners).
