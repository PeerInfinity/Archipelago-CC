# Flash Panel SWFs

Drop pre-injected SWFs here. The panel defaults to loading
`seedling_injected.swf` from this directory.

## Creating `seedling_injected.swf`

From a checkout of the `flash-ap-api` project:

```bash
cd <flash-ap-api-checkout>
python3 inject.py <path-to>/598977_Seedling.swf \
    <this-repo>/frontend/modules/flashPanel/swf/seedling_injected.swf
```

The original unmodified SWF (`598977_Seedling.swf`) is not committed;
fetch it from Newgrounds or use the `Seedling.swf` symlink in the
`flash-ap-api` checkout.

## Browser requirements

For NPAPI Flash (Basilisk + Clean Flash), the page must be served over
`http://localhost` (or a real origin). `file://` will not work because
Flash's `ExternalInterface` inbound calls from JS to Flash require a
page origin.

Ruffle works too but is slow on Seedling. Set `targetPlayer` via the
usual Ruffle polyfill settings if needed.
