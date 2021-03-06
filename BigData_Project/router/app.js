module.exports = function(app, fs) {
	//** app module create **//
	var mysql = require('mysql');
	var crypto = require('crypto');
	var url = require('url');
	var multer = require('multer');
	var gm = require('gm');
	var ejs = require('ejs');
	var async = require('async');
	var parseJSON = require('json-parse-async');
	var querystring = require('querystring');


	//** mysql connection **//
	var conn = mysql.createConnection({
		host: 'localhost',
		user: 'root',
		password: '1234',
		database: 'Project2'
	});

	//** variable **/
	var sess;
	var newName = '';
	var imgDir;

	//** Image Upload **//
	var storage = multer.diskStorage({
		destination:function(req, file, callback) {
			callback(null, __dirname + "/../public/image/memberImg");
		},
		filename:function(req, file, callback) {
			//newName = file.originalname + sess.login_id;
			newName = sess.login_id + file.originalname;
			callback(null, newName);
		}
	});
	var upload = multer({storage:storage}).single('userphoto');

	//** LOGIN **//
	app.get('/', function(req, res) {
		fs.readFile(__dirname + "/../views/login.ejs", 'utf8', function(err, data) {
			if(err) console.log(err);
			else {
				res.send(data);
			}
		});
	});
	app.post('/login', function(req, res) {
		var shasum = crypto.createHash('sha256');
		shasum.update(req.body.login_pw);

		var id = req.body.login_id;
		var pw = shasum.digest('hex');

		sess = req.session;

		conn.query('SELECT COUNT(*) cnt FROM Member WHERE m_email=? and m_pwd=?', [id, pw], function(err, data) {
			if(err) console.log(err);
			else {
				var cnt = data[0].cnt;
				if(cnt == 1) {
					sess.login_id = id;

					//sess.flag = 1;
					conn.query("select concat(d.dp_dirPath,'/', m.mi_imgName) as path from DirectoryPath d join MemberImg m on d.dp_num=m.dp_num where m.m_email=?", [sess.login_id], function(err, data) {
						if(err) console.log(err);
					//	else console.log(data[0]);
					});

					res.send('<script>alert("LOGIN SUCCESS"); location.href="/main";</script>');
				} else {
					res.send('<script>alert("WRONG ID OR PASS");location.href="/";</script>');//history().back();
				}
			}
		});
	});

	//** LOGOUT **//
	app.get('/logout', function(req, res) {
		req.session.destroy(function(err) {
			if(err) console.log(err);
			else {
				console.log("logout sess : " + sess);
				res.send('<script>alert("LOGOUT SUCCESS");location.href="/";</script>');
			}
		});
	});

	//** MAIN **//
	app.get('/main', function(req, res) {
		//console.log("sess : " + sess);
		//console.log("sess.login_id : " +  sess.login_id);
		//if(sess == 'undefined') res.redirect('/');

		fs.readFile(__dirname + "/../views/main.ejs", 'utf8', function(err,mainEjs) {
			var mainTasks = [
				function(callback) {
					if(typeof sess == 'undefined' || sess == 'undefined') {
						console.log("sess : " + sess);
						res.redirect('/');
						//callback(null);
					} else {
						callback(null);
						console.log("step 01");
					}
				},
				function(callback) {
					console.log("step 02");
					conn.query('select d.dp_dirPath, m.mi_imgName from DirectoryPath d join MemberImg m on d.dp_num=m.dp_num where m.m_email=?', [sess.login_id], function(err, rows) {
						if(err) return callback(err);
						imgDir = rows[0].dp_dirPath + "/" + rows[0].mi_imgName;
						callback(null);
					});
				},
				function(callback) {
					conn.query("SELECT A.c_num, (select d_districtName from District where d_districtCode = A.d_districtCode) d_districtName, (select t_themeName from Theme where t_themeCode = A.t_themeCode) t_themeName, A.c_clubName, CONCAT(B.dp_dirPath,'/',A.ci_imgName) AS path FROM (SELECT c.c_num, c.d_districtCode, c.t_themeCode, c.c_clubName, ci.ci_imgName, ci.dp_num FROM Club c JOIN ClubImg ci ON c.c_num=ci.c_num) A JOIN DirectoryPath B WHERE A.dp_num=B.dp_num", function(err, rows) {
						if(err) return callback(err);
						var ClubArray = new Array();
						for(var i=0;i<rows.length;i++){
							ClubArray.push(rows[i]);
						}
						console.log("ClubArray=" + ClubArray);
						callback(null, ClubArray);
					});
				},
				function(ClubArray,callback) {
					res.send(ejs.render(mainEjs, {
						sessId : sess.login_id,
						profileImg: imgDir,
						club: ClubArray
					}));
					callback(null);
				}
			];
			async.waterfall(mainTasks, function(err) {
				if(err) console.log(err);
				else {
					//res.send(ejs.render(data, {data: concat}));
					console.log("finish");
				}
			});
		});
	});


	//** JOIN **//
	app.post('/join', function(req, res) {
		var body = req.body;
		var shaPass = crypto.createHash('sha256');
		shaPass.update(body.join_pw);
		var shaJoinPw = shaPass.digest('hex');

		conn.query('INSERT INTO Member (m_email, m_pwd, m_sex, m_year, m_month, m_day, m_balance) VALUES (?,?,?,?,?,?,0)', [body.join_id, shaJoinPw, body.gender, body.year, body.month, body.day], function(err) {
			if(err) console.log(err);
			else {
				//res.redirect('/');
			}
		})

		conn.query('insert into MemberImg(m_email, dp_num, mi_imgName) values (?,1,"default.png")', [body.join_id], function(err) {
			if(err) console.log(err);
			else {
				res.redirect('/');
			}
		});
	});

	//** profile -> imgupload **//
	// $$$$$$$ /profile 경로 모달��??�면 ?�라��??�정 $$$$$$$ //
	app.get('/profile', function(req, res) {
		fs.readFile(__dirname + "/../views/profile.html", 'utf8', function(err, data) {
			if(err) console.log(err);
			else {
				res.send(data);
			}
		});
	});
	app.post('/uploadImg', function(req, res) {
		upload(req, res, function(err) {
			if(err) {
				console.log(err);
				return res.end("Error : Image Upload Fail");
			}
			console.log(req.file);

			conn.query('UPDATE MemberImg SET mi_imgName=? WHERE m_email=?', [newName, sess.login_id], function(err, result) {
				if(err) {
					console.log(err);
				} else {
					console.log(newName);
					console.log(sess.login_id);
				}
			});
			//res.redirect("/main");
			//res.send('<script>alert( SUCCESS Image Upload");location.href="/main";</script>');
			//res.end("Success Image Upload");
			res.send('<script>alert("Success Image upload"); location.href="/main";</script>');
		});
	});

	//** history **//
	app.get('/history',function(req,res){
	console.log("session : "+sess.login_id);
		var hisq = "select c.c_clubName, h.h_date from History h join Club c where c.c_num = h.c_num and h.m_email=? order by h_date desc limit 15";
		conn.query(hisq,[sess.login_id],function(err,result){
				console.log("history : "+result);
				res.render('history',
			{
				sessId : sess.login_id,
				profileImg: imgDir,
				enter : result
			});
		});
	});
	app.get('/history/pay',function(req,res){
		fs.readFile(__dirname+"/../views/history.ejs",'utf8',function(err,data){
			console.log(__dirname);

			var payq = "select F.c_clubName, E.pc_name, E.cp_price, E.p_date from (select C.c_num, D.pc_name, C.cp_price,C.p_date from (select A.c_num, A.pc_code, B.cp_price, A.p_date from (select c_num, pc_code, p_date from Payment where m_email=?) as A join ClubProduct B where A.c_num=B.c_num and A.pc_code=B.pc_code) as C join ProductCode D where C.pc_code=D.pc_code) as E join Club F where E.c_num=F.c_num order by E.p_date desc limit 15";

			conn.query(payq,[sess.login_id],function(err,result){
				if(err) console.log(err);
				else{
					var strData = JSON.stringify(result);
					res.end(strData);
				}

			});
		});
	});
	app.get('/history/charge',function(req,res){
		var chargeq ="SELECT mc_charge, DATE_FORMAT(mc_date,'%Y %c/%e %r') AS time FROM MoneyCharge WHERE m_email=? ORDER BY time DESC limit 15";

			conn.query(chargeq,[sess.login_id],function(err,result){
				if(err) console.log(err);
				console.log("charge: "+result);
				var strData = JSON.stringify(result);
				res.end(strData);
			});
	});

	//** QRcode **//
	app.get('/qrcode', function(req, res) {
		var QR_String = 'http://chart.apis.google.com/chart?cht=qr&chs=350x350&chl=';
		var sessJson = JSON.stringify(sess);
		var sessStr = JSON.parse(sessJson, function(key, value) {
			if(key == "login_id") {
				QR_String = QR_String + value;
				//res.redirect(QR_String);
				console.log(QR_String);
			}
		});
		res.redirect(QR_String);
		/*
		fs.readFile(__dirname + '/../views/QRcode.html', 'utf8', function(err, data) {
			if(err) console.log(err);
			else {
				res.redirect(QR_String);
			}
		});
		*/
	});
	app.post('/QRcode_data', function(req, res) {
		var reqStr = JSON.stringify(req.body);
		parseJSON(reqStr, function(err, cont) {
			var code_val = cont.code;
			var id_val = cont.m_email;
			var num_val = cont.c_num;
			var pc_val = cont.pc_code;

			//console.log(code_val + ", " + id_val + ", " + num_val + ", " + pc_val);

			if(code_val == "1") {
				var sql = "insert into History(m_email, c_num, h_date, h_dayName, h_status) values(?,?,now(), (select case DAYOFWEEK(now()) when '1' then 'sunday' when '2' then 'monday' when '3' then 'tuesday' when '4' then 'wednesday' when '5' then 'thursday' when '6' then 'friday' when '7' then 'saturday' END AS dayofweek), 1)";

				conn.query(sql, [id_val, num_val], function(err, results) {
					if(err) {
						console.log(err);
						res.writeHead(404, {
							"Content-Type" : "text/html"
						});
						res.end('입장 실패');
					}
					else {
						console.log("insert success");
						res.writeHead(200, {
							"Content-Type" : "text/html"
						});
						res.end('입장 성공');
					}
				});
			} else if(code_val == "2") {
				var userBalance;
				var proPrice;

				// waterfall sync function && thread
				var tasks = [
					//var userBalance;
					//var proPrice;

					function (callback) {
						conn.query('select m_balance from Member where m_email=?', [id_val], function(err, rows) {
							if(err) return callback(err);
							if(rows.length == 0) return callback("Error : No results");
							userBalance = rows[0].m_balance;
							console.log("userBalance : " + userBalance);
							callback(null, userBalance);
						});
					},
					function (userBalance, callback) {
						conn.query('select cp_price from ClubProduct where c_num=? and pc_code=?', [num_val, pc_val], function(err, rows) {
							if(err) return callback(err);
							proPrice = rows[0].cp_price;
							console.log("proPrice : " + proPrice);
							callback(null, proPrice, userBalance);
						});
					},
					function(proPrice, userBalance, callback) {
						if((userBalance - proPrice) < 0) {
							console.log("not enough money");
						} else {
							conn.query("insert into Payment(m_email, pc_code, c_num, p_date, p_dayName) values (?,?,?,now(), (select case DAYOFWEEK(now()) when '1' then 'sunday' when '2' then 'monday' when '3' then 'thuesday' when '4' then 'wednesday' when '5' then 'thursday' when '6' then 'friday' when '7' then 'saturday' END AS dayofweek))", [id_val, pc_val, num_val], function(err, rows) {
								if(err) return callback(err);
								else {
									console.log("Success insert data into Payment");
									//callback(null, proPrice);
								}
							});
						}
						callback(null, proPrice, userBalance);
					},
					function(proPrice, userBalance, callback) {
						if((userBalance - proPrice) >= 0) {
							conn.query('update Member set m_balance = m_balance - ? where m_email=?', [proPrice, id_val], function(err, rows) {
								if(err) return callback(err);
								else {
									console.log("Success update data from Member");
								}
							});
						} else {
							console.log("not enough money");
						}
					},
					function(results, callback) {
						//console.log(results);
						callback(null);
					}
				];

				async.waterfall(tasks, function(err) {
					if(err) {
						console.log(err);
						res.writeHead(400, {
							"Content-Type" : "text/html"
						});
						res.end("결제 실패");
					} else {
						console.log("Finish Thread-Callback Function");
						res.writeHead(200, {
							"Content-Type" : "text/html"
						});
						res.end('결제 성공');
					}
				});
			}
		});
	});

	//** charge **//
	app.get('/charge', function(req, res) {
		fs.readFile(__dirname + "/../views/charge.ejs", 'utf8', function(err, data) {
			if(err) console.log(err);
			else {
				res.render('charge.ejs',
			{
				sessId : sess.login_id,
				profileImg: imgDir,
			});
			}
		});
	});
	app.post('/charge', function(req, res) {
		var chargeTasks = [
			function (callback) {
				conn.query('insert into MoneyCharge(m_email, mc_charge, mc_date) values(?,?,now())', [sess.login_id, req.body.charge], function(err, rows) {
					if(err) return callback(err);
					else {
						console.log("Success insert data into MoneyCharge");
					}
				});
				callback(null);
			},
			function(callback) {
				conn.query('update Member set m_balance = m_balance + ? where m_email=?', [req.body.charge, sess.login_id], function(err, rows) {
					if(err) return callback(err);
					else {
						console.log("Success update Member Balance");
					}
				});
			},
			function(callback) {
				callback(null);
			}
		];

		async.waterfall(chargeTasks, function(err) {
			if(err) console.log(err);
			else {
				console.log("Finish Callback Function");
				//res.redirect('/main');
			}
		});
		//res.redirect('/main');
		res.send('<script>alert("Charged Success");location.href="/main";</script>');
	});

	//** ClubDetail **//
	app.get('/clubDetail',function(req,res){
		console.log("welcome! clubinfo");
		console.log(req.query.c_num);
		console.log(req.params.c_num);
			conn.query("select F.ci_startTime, F.ci_endTime, F.ci_price, F.ci_phone, F.ci_infoDJ,F.ci_guest,F.ci_event, E.path from (select C.c_num,C.c_clubName,CONCAT(D.dp_dirPath,'/',C.ci_imgName) AS path from (select A.c_num,A.c_clubName,B.ci_imgName,B.dp_num from (select c_num,c_clubName from Club where c_num=?) A join ClubImg B where A.c_num = B.c_num) C join DirectoryPath D where C.dp_num = D.dp_num) E join ClubInfo F where E.c_num = F.c_num",
			[req.query.c_num],function(err, result){
				console.log(result);
					res.render('clubDetail2',
				{
					sessId : sess.login_id,
					profileImg: imgDir,
					clubinfo : result,
					c_num : req.query.c_num

				});
		});
	});

	app.get('/clubDetail/drink',function(req,res){

		console.log("clubinfo default get parameter : "+req.query.c_num);
		sql ="select C.c_num, C.pc_code, C.pc_name, C.cp_price, CONCAT(D.dp_dirPath,'/',C.pc_saveName) AS path FROM (SELECT A.c_num, A.pc_code, B.pc_name, B.pc_saveName, B.dp_num, A.cp_price FROM (SELECT * FROM ClubProduct WHERE c_num=?) A JOIN ProductCode B WHERE A.pc_code=B.pc_code) C JOIN DirectoryPath D WHERE C.dp_num=D.dp_num";

		conn.query(sql,[req.query.c_num],
		function(err, result){
			if(err) console.log(err);
			var test = JSON.stringify(result);
			console.log(result[0].pc_name);

			res.end(test);
			//res.send(ejs.render(''))
		});

	});
// 	app.get('/clubDetail/chart',function(req,res){
// 		fs.readFile(__dirname+"/../views/clubDetail2.ejs",'utf8',function(err,data){
// 		console.log("you click chart button");
// 
// 		var testsql = "select * from Member";
// 		conn.query(testsql,function(err,result){
// 			if(err) console.log(err);
// 			var strData = JSON.stringify(result);
// 			res.end(strData);
// 		});
// 	});
// 	});

	//** EXIT **//
	app.get('/exit', function(req, res) {
		conn.query('select h_status from History where h_status = 1', [sess.login_id], function(err, data) {
			if(data.length >= 1) {
				conn.query('update History set h_status=0 where h_status=1 and m_email=?', [sess.login_id], function(err, rows) {
					if(err) console.log(err);
					else {
						res.send('<script>alert("퇴장 완료");location.href="/main";</script>');
					}
				});
			} else {
				res.send('<script>alert("이미 퇴장 했다 임마!!");location.href="/main";</script>');
			}
		});
	});

	//** SampleChart **//
	/*
	app.get('/chart', function(req, res) {
		//var test = "/part-m-00000";
		fs.readFile(__dirname + "/../views/hadoopFile/part-m-00000.txt", 'utf8', function(err, data) {
			if(err) console.log(err);
			res.end(data);
		});
	});
	*/
	app.get('/clubDetail/chart',function(req,res){
		console.log("hello fileread");
		console.log("c_num : "+req.query.c_num);
		fs.readFile(__dirname+"/../public/hadoopData/club" + req.query.c_num, 'utf8', function(error, data){
			console.log(data);
			//var data2 = JSON.stringify(data);
			//console.log(data2);
			res.end(data);
		});
	});

} // *** finish app module
