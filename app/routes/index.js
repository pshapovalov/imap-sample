/*
 * GET home page.
 */

var emailSettings = require('../settings.json');
var Imap = require('imap');
var MailParser = require('mailparser').MailParser;
var EventEmitter = require('events').EventEmitter;


var imap = new Imap(emailSettings);
var emitter = new EventEmitter();
var messagesCount = 0;
var renderCount = 0;
var messages =[];



exports.index = function(req, res){
    // Render responces when all messages are processed
    emitter.on('mails:parsed', function(){
        console.log('All messages have been processed!');
        res.render('index', { count: messagesCount, messages: messages });
    });

    // Imap handlers
    imap.once('ready', function() { openInbox(fetchMessages); });
    imap.once('error', function(err) { console.log(err); return; });
    imap.once('end', function() { console.log('Connection ended'); });
    imap.connect();

    function openInbox(callback) {
        imap.openBox('INBOX', true, callback);
    }

    // Fetches all the massages from box. Then gets header and body from the messages.
    function fetchMessages(err, box){
        if (err) throw err;

        messagesCount = box.messages.total;

        // fetch messages
        var f = imap.seq.fetch('1:' + messagesCount, {
            bodies: ['TEXT','HEADER.FIELDS (FROM TO SUBJECT DATE)'],
            struct: true
        });

        // processing messages
        f.on('message', function(msg, seqno) {
            var index = seqno - 1;
            messages[index] = {};
            msg.on('body', function(stream, info) {
                var buffer = '';
                stream.on('data', function(chunk) {
                    buffer += chunk.toString('utf8');
                });
                stream.once('end', function() {
                    // parse message header
                    messages[index].header = Imap.parseHeader(buffer);
                    // parse message body
                    if (info.which === 'TEXT') {
                        parseBody(buffer, index)
                    }
                });
            });
        });

        f.once('error', function(err) {
            console.log('Fetch error: ' + err);
        });

        // close imap connection
        f.once('end', function() {
            imap.end();
            console.log('All messages have been fetched!');
        });
    }

    // Parses mail body
    function parseBody(buffer, index) {
        var mailparser = new MailParser({streamAttachments: false, showAttachmentLinks: false, debug: false});
        mailparser.on('end', function(mail_object){
            renderCount++
            messages[index].text = mail_object.text;
            if (renderCount === messagesCount) {
                emitter.emit('mails:parsed');
            }
        });
        mailparser.write(buffer);
        mailparser.end();
    }
};




