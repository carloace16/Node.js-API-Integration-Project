const fs = require('fs');
const http = require('http');
const https = require('https');
const querystring = require('querystring');

const port = 3000;

const server = http.createServer();
server.on("request", request_handler);
server.on("listening", listen_handler);
server.listen(port);

function listen_handler() {
    console.log(`Now Listening on Port ${port}`);
}

function request_handler(req, res) {
    console.log(req.url);
    if (req.url === "/") {
        const form = fs.createReadStream("html/index.html");
        res.writeHead(200, { "Content-Type": "text/html" });
        form.pipe(res);
    } else if (req.url.startsWith("/search")) {
        const user_input = new URL(req.url, `https://${req.headers.host}`).searchParams;
        console.log(user_input);
        const statusCode = user_input.get('status');
        if (statusCode == null || statusCode == "") {
            res.writeHead(404, { "Content-Type": "text/html" });
            res.end("<h1>Missing Input</h1>");
        } else {
            console.log("API 1 has been called");
            fs.readFile('./auth/credentials.json', 'utf8', function(err, data) {
                if (err) {
                    console.error('Error reading credentials file:', err);
                    res.writeHead(500, { "Content-Type": "text/html" });
                    res.end("<h1>Error reading credentials file. Please try again later.</h1>");
                    return;
                }
                const credentials = JSON.parse(data);
                const imgbbApiKey = credentials.imgbbApiKey;

                const http_cat_url = `https://http.cat/${statusCode}`;
                https.get(http_cat_url, function(http_cat_res) {
                    let data = Buffer.from([]);
                    http_cat_res.on('data', function(chunk) {
                        data = Buffer.concat([data, chunk]);
                    });
                    http_cat_res.on('end', function() {
                        const imgData = data.toString('base64');
                        console.log("API 2 has been called");
                        const imgbbApiData = querystring.stringify({
                            key: imgbbApiKey,
                            image: imgData
                        });

                        const options = {
                            hostname: 'api.imgbb.com',
                            port: 443,
                            path: '/1/upload?expiration=600&key=' + imgbbApiKey,
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/x-www-form-urlencoded',
                                'Content-Length': Buffer.byteLength(imgbbApiData)
                            }
                        };

                        const imgbbApiReq = https.request(options, function(imgbbApiRes) {
                            let responseData = '';
                            imgbbApiRes.on('data', function(chunk) {
                                responseData += chunk;
                            });
                            imgbbApiRes.on('end', function() {
                                try {
                                    const imgbbResponse = JSON.parse(responseData);
                                    if (imgbbResponse && imgbbResponse.data && imgbbResponse.data.url) {
                                        const imgbbImageUrl = imgbbResponse.data.url;
                                        res.writeHead(200, { "Content-Type": "text/html" });
                                        res.write(`<h1>Image uploaded successfully to your imgbb account! <img src="${imgbbImageUrl}" alt="Cat Image"/></h1>`);
                                        res.end();
                                        console.log("Image uploaded successfully to your imgbb account!");
                                    } else {
                                        console.error('Invalid response from imgbb API:', imgbbResponse);
                                        res.writeHead(500, { "Content-Type": "text/html" });
                                        res.end("<h1>Invalid response from imgbb API. Please try again later.</h1>");
                                    }
                                } catch (error) {
                                    console.error('Error parsing response from imgbb API:', error);
                                    res.writeHead(500, { "Content-Type": "text/html" });
                                    res.end("<h1>Error parsing response from imgbb API. Please try again later.</h1>");
                                }
                            });
                        });

                        imgbbApiReq.on('error', function(error) {
                            console.error('Error accessing imgbb API:', error);
                            res.writeHead(500, { "Content-Type": "text/html" });
                            res.end("<h1>Error accessing imgbb API. Please try again later.</h1>");
                        });

                        imgbbApiReq.write(imgbbApiData);
                        imgbbApiReq.end();
                    });
                }).on('error', function(error) {
                    console.error('Error accessing HTTP Cat API:', error);
                    res.writeHead(500, { "Content-Type": "text/html" });
                    res.end("<h1>Error accessing HTTP Cat API. Please try again later.</h1>");
                });
            });
        }
    } else {
        res.writeHead(404, { "Content-Type": "text/html" });
        res.end("<h1>Not Found</h1>");
    }
}
