const stcookie = require("st-cookie-parser")
module.exports = (function (query, option) {
    option.table = option.table ? option.table : 'st_session';
    option.sessionid = option.sessionid ? option.sessionid : 'STSESSID';
    option.basics = option.basics ? option.basics : {
        Path: '/',
        SameSite: 'Lax',
        HttpOnly: true,
        Secure: true,
    };

    function create_table() {
        return (async () => {
            let query_ = "CREATE TABLE `" + option.table + "` ( " +
                "  `session_id` varchar(128) NOT NULL default '', " +
                "  `expires` int(11), " +
                "  `data` mediumtext, " +
                "  PRIMARY KEY (`session_id`) " +
                ")";
            return await query(query_);
        })();
    }

    function makeid(length) {
        var result = '';
        var characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        var charactersLength = characters.length;
        for (var i = 0; i < length; i++) {
            result += characters.charAt(Math.floor(Math.random() * charactersLength));
        }
        return result;
    }

    function create_new_session(req, res, value) {
        return (async () => {
            let sessid = makeid(40);
            while (true) {
                let max_age = stcookie.expire_time(option.basics); // option.basics['Max-Age'];
                delete option.basics['Max-Age'];
                delete option.basics['Expires'];
                if (max_age > -1) {
                    option.basics['Max-Age'] = max_age;
                    max_age += timestamp();
                } else {
                    max_age = 0;
                }
                if (option.keep_lasting_time) {
                    option.basics['Max-Age'] = option.keep_lasting_time.last; // 쿠키 유지시간 설정
                    max_age = option.keep_lasting_time.renew; // 세션ID갱신 주기 설정
                    max_age += timestamp();
                }

                result = await query("insert into " + option.table + " (session_id, expires, data) values (?,?,?)", [sessid, max_age, JSON.stringify(value)]);
                let error = result.errno && result.constructor.name === 'Error';
                if (!error) {
                    let cookie = get_cookie(req);
                    cookie[option.sessionid] = sessid;
                    req.headers.cookie = stcookie.stringify(cookie);
                    let newCookie = {
                        [option.sessionid]: sessid,
                        ...option.basics,
                    };
                    res.set('Set-Cookie', stcookie.stringify(newCookie));
                    break;
                } else {
                    if (result.errno === 1146) {
                        await create_table();
                    }
                    if (result.errno === 1062) {
                        sessid = makeid(40);
                    }
                }
            }
            return sessid;
        })();
    }

    function get_cookie(req) {
        let cookie = req.headers.cookie ? stcookie.parse(req.headers.cookie) : {};
        return cookie;
    }

    function get_sessid(req) {
        let sessid = get_cookie(req)[option.sessionid];
        if (sessid === undefined) {
            sessid = '';
        }
        return sessid;
    }

    function timestamp() {
        return Math.round(new Date().getTime() / 1000);
    }

    return {
        get_attributes(req, res) {
            return (async () => {
                let result = await query("select * from " + option.table + " where session_id = ?", [get_sessid(req)]);
                let error = result.errno && result.constructor.name === 'Error';
                if (!error && result.length === 1) {
                    let sess = result[0];
                    let data = JSON.parse(sess.data);
                    let exp = Number(sess.expires) > 0 && Number(sess.expires) < timestamp();
                    if (exp) {
                        await query("delete from " + option.table + " where session_id = ?", [get_sessid(req)]);
                        await create_new_session(req, res, data);
                    }
                    return data;
                } else {
                    if (error && result.errno === 1146) {
                        await create_table();
                    }
                    return {};
                }
            })();
        },
        set_attributes(req, res, value, overwrite) {
            return (async () => {
                if (get_sessid(req) === '') {
                    await create_new_session(req, res, value);
                } else {
                    if (!overwrite) {
                        let pre = await this.get_attributes(req, res);
                        value = {
                            ...pre,
                            ...value
                        };
                    }
                    let result = await query("update " + option.table + " set data=? where session_id=?", [JSON.stringify(value), get_sessid(req)]);
                    if (!result.affectedRows || result.constructor.name === 'Error') {
                        await create_new_session(req, res, value);
                    }
                }
                return value;
            })();
        },
    }
});
