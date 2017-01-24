# Automatically check AU Stads for new grades ⚡️

## Disclaimer 🔥
Just a dirty hacky hacky script which takes away the burden to check AU's site for new grades when you're waiting for them to be released. Could probably use some refactoring 🙈


## But why  👀
I was getting very inpatient, so I kept checking AU's systems very often.
So I thought I wanted to automate the process, so that I could simply get a text when a new grade was added to my file.

## How to use 🔍
You'll need to set the following environment variables:
- CLOCKWORK_KEY: API key for the [Clockwork](https://www.clockworksms.com/) service which sends the notification text
- LOG_ID: Your unique ID for the [now-logs](https://logs.now.sh/) module, which streams real time logs
- AU_USERNAME: Your AU username
- AU_PASSWORD: Your AU password
- CURRENT_GRADES: The current amount of grades before running the script
- PHONE_NUMBER: Your phone number, this is where the text goes, include your country code + number

**Quickly up and running on [now](https://zeit.co/now)** 🚀
````
$ cd au-grade-checker-dir
$ now -e AU_USERNAME=au123456 -e AU_PASSWORD=myPassword -e CURRENT_GRADES=12 -e CLOCKWORK_KEY=myClockWorkApiKey -e PHONE_NUMBER=4512345678 -e LOG_ID=aUniqueIdentifier
````

## How it works 💪
If you try to reach the results page without being logged in, you get redirected to a login page.
But this redirect is done through a `<meta http-equiv="refresh">` tag, so the [request](https://github.com/request/request) module doesn't follow the redirect.
So we need to fetch the URL from the above tag. This is done through [cheerio](https://github.com/cheeriojs/cheerio) which enables us to easily parse the markup from the redirect page.

The fetched URL leads us to another page, which does a correct HTTP 302 redirect, and we pass this final URL along to the next step.

We're now at the "login" page, and our URL contains important info to the WAYF single sign-on system.
The form's action URL is the page itself, so we create a POST request and pass along our AU username and password.

This results in a weird page where we need to manually POST a hidden "SAMLSResponse" field, and afterwards we need to it again with a new SAMLResponse field and a RelayState field.
Afterwards we're in, we have cookie which is authenticated in the system, yay!

Now we can load up the grade page and parse the markup through cheerio.
We then repeat the above each 5 minute, and if the number of results (grades) goes above the amount we stated in our CURRENT_GRADES variable, we send off a text with the latest grade and we shut down the script.
