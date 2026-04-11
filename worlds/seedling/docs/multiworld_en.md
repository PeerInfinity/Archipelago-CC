# Seedling Setup Guide

## Required Software

- A browser supporting Flash (e.g. [Basilisk Portable with Flash Player](https://archive.org/details/basilisk-portable-with-flash))

## Create a Config (.yaml) File

### What is a config file and why do I need one?

See the guide on setting up a basic YAML at the Archipelago setup
guide: [Basic Multiworld Setup Guide](/tutorial/Archipelago/setup/en)

### Where do I get a config file?

The Player Settings page on the website allows you to configure your personal settings and export a config file from
them. Player settings page: [Seedling Player Settings Page](/games/Seedling/player-settings)

### Verifying your config file

If you would like to validate your config file to make sure it works, you may do so on the YAML Validator
page: [YAML Validation page](/mysterycheck)

## Joining a Multiworld 

After rolling your seed, go to the [Seedling Game](https://madisonsilver.github.io/seedling/) site with your flash-enabled browser 
and enter the server details, your slot name, and a room password if one is required. Then click "Connect to Server".

## Insecure websocket workaround

Currently, the [Seedling Game](https://madisonsilver.github.io/seedling/) site is hosted on an HTTPS-only server, but most browsers will reject  
connections to insecure websockets (e.g. to archipelago.gg).  There are two ways to work around this:
- Enable insecure websockets on secure pages in your browser settings.
- - (e.g. in Basilisk Portable, going to `about:config` then setting `network.websocket.allowInsecureFromHTTPS` to `true`)
- Download the [Seedling Client](https://github.com/madisonsilver/SeedlingArchipelagoClient/tree/main) from Github and host it locally
- - Python can host it by running `<path to your python.exe here> -m http.server 8000` in the directory with the client.