/*
 * GET home page.
 */

var emailSettings = require('../settings.json');
var Imap = require('imap'),
    inspect = require('util').inspect;
var MailParser = require("mailparser").MailParser;
var EventEmitter = require("events").EventEmitter;


var imap = new Imap(emailSettings);
var emitter = new EventEmitter();
var messagesCount = 0;
var renderCount = 0;
var messages =[];



exports.index = function(req, res){
    emitter.on('mails:parsed', function(){
        res.render('index', { count: messagesCount, messages: messages });
    });
    imap.once('ready', function() { openInbox(fetchMessages); });
    imap.once('error', function(err) { console.log(err); return; });
    imap.once('end', function() { console.log('Connection ended'); });
    imap.connect();

    function openInbox(callback) {
        imap.openBox('INBOX', true, callback);
    }

    function fetchMessages(err, box){
        if (err) throw err;
        messagesCount = box.messages.total;
        var f = imap.seq.fetch('1:' + messagesCount, {
            bodies: ['TEXT','HEADER.FIELDS (FROM TO SUBJECT DATE)'],
            struct: true
        });
        f.on('message', function(msg, seqno) {
            var index = seqno - 1; var prefix = '(#' + seqno + ') ';
            messages[index] = {};
            msg.on('body', function(stream, info) {
                var buffer = '', count = 0;
                stream.on('data', function(chunk) {
                    buffer += chunk.toString('utf8');
                });
                stream.once('end', function() {
                    messages[index].header = Imap.parseHeader(buffer);
                    if (info.which === 'TEXT') {
                        // this stream was the body, do something with it
                        var mailparser = new MailParser({streamAttachments: false });
                        mailparser.on("end", function(mail_object){
                            renderCount++
                            messages[index].text = mail_object.text;
                            console.log("Text body:", mail_object.text);
                            if (renderCount === messagesCount) {
                                emitter.emit('mails:parsed');
                            }
                        });
                        mailparser.write(buffer);
                        mailparser.end();
                    }
                });
            });
            msg.once('end', function() {});
        });
        f.once('error', function(err) {
            console.log('Fetch error: ' + err);
        });
        f.once('end', function() {
            console.log('Done fetching all messages!');
            imap.end();
        });
    }
};




