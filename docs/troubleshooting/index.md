# Troubleshooting

Common issues and solutions for DClaw Write.

## Quick Diagnostics

```bash
# Check app pods
kubectl get pods -n dclaw-write

# Check logs
kubectl logs -n dclaw-write deployment/dclaw-write-backend

# Check database
kubectl get clusters -n dclaw-write
```

## Sections

- [Common Issues](./common-issues)
- [FAQ](./faq)
