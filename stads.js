const Request = require('request') 
const cheerio = require('cheerio')
const urlPackage = require('url')

function logging(message) {
    console.log('Log:', message)
}

function Stads() {

    const resultsURL = 'https://sbstads.au.dk/sb_STAP/sb/resultater/studresultater.jsp'
    const providersURL = 'https://wayf.wayf.dk/dsbackend?entityID=https://saml.sbstads.au.dk&query=&start=0&end=10&lang=da&feds=&providerids=&logtag=xxx&delta=1'
    let cookieJar = Request.jar()
    let request = Request.defaults({
        jar: cookieJar
    })
    
    let config = {
        username: '',
        password: '',
        current_grades: 0
    }

    let lib = {}

    lib.setCredentials = ({username, password}) => {
        config.username = username
        config.password = password
    }

    lib.openStadsWithoutCookie = () => {
        request = Request.defaults({
            jar: Request.jar()
        })

        logging('Opening STADS without cookie')

        return new Promise((resolve, reject) => {
            let options = {
                url: resultsURL,
                method: 'GET'
            }

            request(options, (error, response, body) => {
                if (!error) {
                    let $ = cheerio.load(body)

                    let redirectUrl = $('meta[http-equiv="refresh"]').attr('content').replace(/0;url=/, '')

                    logging('Following redirect URL')
                    resolve(redirectUrl)
                } else {
                    reject(error)
                }
            })
        })
    }

    lib.getLoginUrl = (url) => {
        logging('Getting login URL')
        return new Promise((resolve, reject) => {
            let options = {
                url,
                method: 'GET'
            }

            request(options, (error, response, body) => {
                if (!error) {
                    let loginUrl = response.request.uri.href

                    logging('Got login URL')
                    resolve(loginUrl)
                } else {
                    reject(error)
                }
            })
        })
    }

    lib.loginToStadsThroughWayf = (url) => {
        return new Promise((resolve, reject) => {
            let urlParams = new urlPackage.URLSearchParams(url)
            let idp = 'https://birk.wayf.dk/birk.php/wayf.au.dk'
            let wayfUrl = urlParams.get('return') + '&' + urlParams.get('returnIDParam') + '=' + encodeURIComponent(idp)
            let options = {
                url: wayfUrl,
                method: 'GET'
            }

            logging('Parsing WAYF response')

            request(options, (error, response, body) => {
                if (!error) {
                    let loginUrl = response.request.uri.href
                    let options = {
                        url: loginUrl,
                        method: 'POST',
                        form: {
                            username: config.username,
                            password: config.password
                        }
                    }
                    
                    logging('Getting SAML response')

                    request(options, (error, response, body) => {
                        if (!error) {
                            let $ = cheerio.load(body)
                            let form = $('form').eq(0)
                            var postUrl = form.attr('action')
                            var SAMLResponse = form.find('input[name="SAMLResponse"]').val()

                            let options = {
                                url: postUrl,
                                method: 'POST',
                                form: {
                                    SAMLResponse
                                }
                            }

                            logging('Posting SAML response')

                            request(options, (error, response, body) => {
                                if (!error) {
                                    let $ = cheerio.load(body)
                                    let form = $('form#samlform')
                                    let postUrl = form.attr('action')
                                    var formFields = {
                                        SAMLResponse: form.find('input[name=SAMLResponse]').val(),
                                        RelayState: form.find('input[name=RelayState]').val()
                                    }

                                    let options = {
                                        url: postUrl,
                                        method: 'POST',
                                        form: formFields
                                    }

                                    logging('Posting SAML response and relay state')

                                    request(options, (error, response, body) => {
                                        if (!error) {
                                            logging('Logged in')
                                            resolve()
                                        } else {
                                            reject(error)
                                        }
                                    })
                                } else {
                                    reject(error)
                                }
                            })
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

    lib.getGrades = () => {
        let options = {
            url: resultsURL,
            method: 'GET',
            encoding: 'latin1'
        }

        logging('Fetching result page')

        return new Promise((resolve, reject) => {
            request(options, (error, response, body) => {
                if (!error) {
                    logging('Fetched result page')
                    let $ = cheerio.load(body)
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
                        logging('Found ' + results.length + ' grade(s)')
                        resolve(results)
                    } else {
                        logging('Could not find any grades')
                    }
                }
            })
        })
    }

    return lib
}

module.exports = new Stads()