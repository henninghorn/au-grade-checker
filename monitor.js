// Dotenv
require('dotenv').config()

// Library to send SMS
var clockwork = require('clockwork')({
    key: process.env.CLOCKWORK_KEY || 'abc123'
});
let stads = require('./stads')

stads.setCredentials({
    username: process.env.AU_USERNAME,
    password: process.env.AU_PASSWORD
})

function checkGrades() {
    stads.openStadsWithoutCookie()
        .then(url => stads.getLoginUrl(url))
        .then(url => stads.loginToStadsThroughWayf(url))
        .then(stads.getGrades)
        .then(grades => {
            if (grades.length > process.env.CURRENT_GRADES) {
                let text = 'Ny karakter! ' + grades[0].course + ': ' + grades[0].grade
                console.log(text)
                
                clockwork.sendSms({
                  To: process.env.PHONE_NUMBER,
                  Content: text
                }, function (error, response) {
                    if (error) {
                        throw new Error(error)
                    } else {
                        console.log('Message sent')
                    }
                })
            } else {
                console.log('No new grades, still ' + grades.length + ' grades.')
                setTimeout(checkGrades, 1000*60*15)
            }
        })
        .catch(error => {
            console.log({error})
        })
}

checkGrades()