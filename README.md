# Automatically check AU for grades

You'll need to set the following environment variables:
- AU_COOKIE: Very important, your AU Stads cookie
- LOG_ID: An log ID for your real-time now-logs
- CLOCKWORK_KEY: You API key from Clockwork
- PHONE_NUMBER: Yeah...

##
Basically this scripts checks AU systems every 30 second to see if new grades have been added.
Currently the grade count is hardcoded to 11.

When the current grades is not 11 and not 0, then we fire of a SMS via Clockwork to tell about the new grade.
