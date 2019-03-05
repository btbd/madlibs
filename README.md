# Mad Libs

A visual demo for CloudEvents that creates mad libs.

## Usage

To build the server, do `make`. Then run `madlibs`.

To start the demo, press spacebar or click the main CloudEvents node.

To view a request/response, click on one of the nodes.

### Flags

- `-d <string>`
    - Directory for "settings.json" (default ".").
- `--no-https`
    - Disable HTTPS check for admin page.
- `--password <string>`
    - Password for admin page (default "password").
- `-t <int>`
    - Timeout in seconds before an async request is ignored (default 10 seconds).
- `-v <int>`
    - Verbose/debugging level from 0-2 (default 0).

### Admin

To access the admin page, go to `host/admin` on HTTPS (unless `--no-https` is specified).

The admin page allows you to add services and sentences for the client to use.