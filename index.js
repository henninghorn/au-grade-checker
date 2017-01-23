var request = require('request')
var cheerio = require('cheerio')
var clockwork = require('clockwork')({key:process.env.CLOCKWORK_KEY});
var express = require('express')

var logId = process.env.LOG_ID || 'au-stads-log-' + Math.ceil(Math.random()*99999999)

require('now-logs')(logId)

console.log('Log id: ' + logId)

var app = express()

var numberOfChecks = 0

app.get('/', function (req, res) {
  res.send('Checked ' + numberOfChecks + ' times')
})

app.listen('8888')

var interval = setInterval(checkGrades, 30000)

function checkGrades () {
  numberOfChecks++

  var options = {
    url: 'https://sbstads.au.dk/sb_STAP/sb/resultater/studresultater.jsp',
    headers: {
      'User-Agent': 'Dovenskab 2017',
      'Cookie': 'selvbetjening=' + process.env.AU_COOKIE
    }
  }

  console.log(new Date() + ': Checking grades...')
  request(options, function (error, response, html) {
    console.log(new Date() + ': Got response from AU...')
    if (!error) {
      let $ = cheerio.load(html)
      let results = []

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

      if (results.length > 0) {
        console.log(new Date() + ': Current grades', results.length)
        console.log(new Date() + ': ' + results[0].course + ': ' + results[0].grade)
      }

      if (results.length == 11) {
        console.log(new Date() + ': Nothing new')
      } else if (results.length == 0) {
        console.log(new Date() + ': Something went wrong')
        clearInterval(interval)
      } else {
        console.log(new Date() + ': New grades. Closing!')
        clearInterval(interval)
        clockwork.sendSms({
          To: process.env.PHONE_NUMBER,
          Content: 'Ny karakter! ' + results[0].course + ': ' + results[0].grade
        }, function (a, b) {})
      }
    } else {
      console.log('ERROR')
      clearInterval(interval)
    }
  })
}

console.log('Running AU grade checker')
