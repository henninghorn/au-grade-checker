// Library to enable http interface
var Hapi = require('hapi')

var server = new Hapi.Server()
server.connection({
  host: 'localhost',
  port: 8000
})

server.route({
  method: 'GET',
  path: '/',
  handler: (request, reply) => {
    return reply(logs)
  }
})

server.start(err => {
  if (err) throw err

  logThis('Server running at: ' + server.info.uri)
})

// Collection of logs
var logs = []

// Library to perform HTTP request
var request = require('request')

// Library to parse HTML
var cheerio = require('cheerio')

// Library to send SMS
var clockwork = require('clockwork')({key: process.env.CLOCKWORK_KEY || 'abc123'});

// Library to stream real time logs
var logId = process.env.LOG_ID || 'au-stads-log-' + Math.ceil(Math.random()*99999999)
console.log('Log ID: ' + logId)
require('now-logs')(logId)

// The page where the results lives
var resultsURL = 'https://sbstads.au.dk/sb_STAP/sb/resultater/studresultater.jsp'
var AU_USERNAME = process.env.AU_USERNAME || ''
var AU_PASSWORD = process.env.AU_PASSWORD || ''
var CURRENT_GRADES = process.env.CURRENT_GRADES || ''
var PHONE_NUMBER = process.env.PHONE_NUMBER || ''

// Let's create a cookie jar to hold our cookies between requests
var cookieJar = request.jar()

// Set this jar as a default for all requests
var request = request.defaults({
  jar: cookieJar
})

var interval = setInterval(goCheck, 60000*5)

goCheck()

function goCheck() {
  // Clear logs
  logs = []

  openStadsWithoutCookie()
  .then(url => getLoginURL(url))
  .then(url => loginToStadsThroughWayf(url, AU_USERNAME, AU_PASSWORD))
  .then(page => performManualLogin(page))
  .then(() => parseResultsPage(resultsURL))
  .then(results => {
    if (results.length > CURRENT_GRADES) {
      logThis('A new grade! Newest: ' + results[0].course)
      clearInterval(interval)
      clockwork.sendSms({
        To: PHONE_NUMBER,
        Content: 'Ny karakter! ' + results[0].course + ': ' + results[0].grade
      }, function (a, b) {})
    } else {
      logThis('Nothing new, just ' + results.length + ' grades available')
    }
  })
  .catch(error => {
    clearInterval(interval)
    console.log('error', error)
  })
}

// We can't follow meta tag or javascript redirects
// So we'll manually post noscript forms
// page: Markup from the noscript page
function performManualLogin(page) {
  return new Promise(function (resolve, reject) {
    // Load up the page through cheerio <3
    var $ = cheerio.load(page)

    // Fetch form action URL and the hidden SAMLResponse field
    var form = $('form').eq(0)
    var postURL = form.attr('action')
    var SAMLResponse = form.find('input[type="hidden"]').val()

    // Setup our request
    var requestOptions = {
      url: postURL,
      method: 'POST',
      form: {
        SAMLResponse
      }
    }

    request(requestOptions, function (error, response, body) {
      if (!error) {
        // We end up getting redirected to another page
        // where we need to perform another manual login
        // So bascially the same thing as before
        var $ = cheerio.load(body)
        var form = $('form#samlform')
        var postURL = form.attr('action')
        var formFields = {
          SAMLResponse: form.find('input[name=SAMLResponse]').val(),
          RelayState: form.find('input[name=RelayState]').val()
        }

        var requestOptions = {
          url: postURL,
          method: 'POST',
          form: formFields
        }

        request(requestOptions, function (error, response, body) {
          if (! error) {
            // Yay, we probably got through, so let's resolve our promise
            resolve()
          } else {
            reject(error)
          }
        })
      } else {
        reject(error)
      }
    })
  })
}

// We use this function when our jar contains the right cookies
// We then load the page and parse it through cheerio :)
function parseResultsPage(url) {
  logThis('Lets go to the results page...')
  return new Promise(function (resolve, reject) {
    var requestOptions = {
      url: url,
      method: 'GET'
    }

    request(requestOptions, function (error, response, html) {
      if (!error) {
        // We seem to have some html to play with
        // Let's load it up
        let $ = cheerio.load(html)
        let results = []

        // This is where the results are saved
        // Let's go through them
        $('#resultTable tbody tr').each(function (i, el) {
          let columns = $(this).find('td')
          results.push({
            course: columns.eq(0).text().trim(),
            date: columns.eq(1).text().trim(),
            grade: columns.eq(2).text().trim(),
            ectsGrade: columns.eq(3).text().trim(),
            ectsPoints: columns.eq(4).text().trim(),
          })
        })

        // Let's check our results
        if (results.length > 0) {
          // We got something, parse them along with our promise resolve method
          logThis('Got some grades from page, ' + results.length + ' in total')
          resolve(results)
        } else {
          // Something went wrong, maybe no results or just a failed page load
          logThis('Could not see any results...')
          reject('Could not fetch results')
        }
      } else {
        logThis('Error loading results page...')
        reject(error)
      }
    })
  })
}

// We need to follow some browser-only redirects
// to get the real url to post our credentials to
function getLoginURL(url) {
  logThis('Fetching real login URL...')
  return new Promise(function (resolve, reject) {
    var requestOptions = {
      url: url,
      method: 'GET'
    }

    request(requestOptions, function (error, response, body) {
      if (!error) {
        logThis('Got the URL, following it...')
        resolve(response.request.uri.href)
      } else {
        logThis('Could not get URL...')
        reject(error)
      }
    })
  })
}

// Let's post our credentials to WAYF!
function loginToStadsThroughWayf(url, username, password) {
  logThis('Logging into AU Stads through WAYF...')
  return new Promise(function (resolve, reject) {
    var requestOptions = {
      url: url,
      method: 'POST',
      form: {
        username,
        password
      }
    }

    request(requestOptions, function (error, response, body) {
      if (!error) {
        logThis('Login success')
        resolve(body)
      } else {
        logThis('Login failed')
        reject(error)
      }
    })
  })
}

// Let's try to open AU Stads without a cookie
// This will result in a great cookie and query parameters
// we need to use later on
function openStadsWithoutCookie() {
  logThis('Trying to open AU Stads without cookie...')

  // So yeah, this is not pretty
  // We smash all cookies
  request = request.defaults({
    jar: request.jar()
  })

  return new Promise(function (resolve, reject) {
    var requestOptions = {
      url: resultsURL,
      method: 'GET'
    }

    request(requestOptions, function (error, response, body) {
      if (!error) {
        logThis('Got cookie, following redirect...')
        var $ = cheerio.load(body)

        // Weird redirect
        var gotoURL = $('meta[http-equiv="refresh"]').attr('content').replace(/0;url=/, '')

        resolve(gotoURL)
      } else {
        reject(error)
      }
    })
  })
}

// What is this?
function logThis(log) {
  var entry = new Date() + ': ' + log
  logs.push(entry)
  console.log(entry)
}
