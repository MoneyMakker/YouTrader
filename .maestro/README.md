# YouTrader Maestro Smoke Tests

These flows are release-readiness smoke tests for a local simulator/device. They do not require Maestro Cloud and they do not make real purchases.

Run all flows:

```bash
maestro test .maestro
```

Run one flow:

```bash
maestro test .maestro/01_app_launch.yaml
```

Install Maestro locally:

```bash
curl -Ls "https://get.maestro.mobile.dev" | bash
```

Use a simulator/TestFlight/dev build pointed at safe test data. Do not run destructive flows against a production journal with private data.

