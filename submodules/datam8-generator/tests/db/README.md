# Test databases

## SQL Server

For local development and testing, as well as ci/cd purposes, Microsoft's sample Adventure Works DB is used.
To make it easier here are some instructions to get it running with docker/-compose (or any equivalent).

Download the the official `Adventure Works LT 2017` Version and put the `.bak` into a reachable directory.
2017 is used for compatibility reasons.

Set an environment variables pointing to the directory containing the `.bak` file as `DATAM8_DB_BACKUPS`. This
is will be mounted into the container to allow importing the Adventure Works DB.

Make sure you are inside the `db` directory.

```sh
# downloads the container image and starts it
docker compose up -d

# imports (restores) the adventrue works db
docker exec adventure-works-for-datam8 /bin/bash /restore-db.sh #
```

To Clean it up or simply stop it run. Deleting the data directory will reset the state of the container.

```sh
docker compose down
```
