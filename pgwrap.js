var crypto = require('crypto');
var btoa = require('btoa');

// todo in this file:
// read query into json
//depth arrays?

// schema cannot have anything called "group"


//-----------------------------------------------------------------------------------------
//-----------------------------------------------------------------------------------------
// all pg.connect queries need to be reviewed and converted to prepared statements
//-----------------------------------------------------------------------------------------
//-----------------------------------------------------------------------------------------

var dmfig = function(s){
    // determine the first delimiter of style $N$ which isnt present
    var n=0;
    var S = JSON.stringify(s);
    var ns = btoa(''+((n-n%100)/100)+''+((n%100-n%10)/10)+''+n%10);

    while( (new RegExp('$'+ns+'$')).test(S) ) ++n;
    return '$'+ns+'$';
};


module.exports = function(pg, conop, schemas){

    pg.conop = conop;
    pg.schemas = schemas;
    
    pg.insert = function(schemaName, query, options, callback){
	
// use schema.tableName
	var schema = schemas.db[schemaName];

	var qreq = 'insert into '+schema.tableName+' (';
	var valreq = ') values (';

	if(!('hash' in query)){
	    // make up a hash
            var hmac = crypto.createHmac("sha1", "the toronto maple leafs are garbage"); 
            var hash2 = hmac.update(''+((new Date()).getTime())+''+Math.random());
            var digest = hmac.digest(encoding="base64");

	    query.hash = digest;//28chars good enough
	}

//extend this for multidim arrays?
	for(var ff in schema.fields){
	    if(ff === schemaName+'_xattrs') continue;
	    if(!(ff in query)) if('defval' in schema.fields[ff]) query[ff] = schema.fields[ff].defval;

	    if(ff in query){
		qreq += ff + ',';
		
		var dm = dmfig(query[ff]);

		if(schema.fields[ff].type.indexOf('varchar')>-1){
		    //string
		    //if empty string put null
		    if((typeof query[ff] === 'undefined')||
		       ((JSON.stringify(query[ff]) === 'null')&&(query[ff] !== 'null'))){
			valreq += 'null,';
			continue;
		    }

// there might be some bugs relating to pulling null out of the db. keep these here in the meantime
		    if(!query[ff].length){
			valreq += 'null,';
			continue;
		    }

		    if(schema.fields[ff].type.indexOf('[')===-1){
			valreq += dm + query[ff] + dm + ',';
		    }else{
			//array
			if(!query[ff].length){
			    valreq += ',';
			}else{
			    valreq += 'ARRAY[';
			    for(var i=query[ff].length; i-->0;) valreq += dm + query[ff][i] + dm + ',';
			    valreq = valreq.substr(0, valreq.length-1);
			    valreq += '],';
			}
		    }


		}else if(schema.fields[ff].type === 'timestamp'){
		    //timestamp
		    if(query[ff] === 'now()') valreq += dm + (new Date()).toISOString() + dm + ',';
		    else valreq += dm + (new Date(query[ff])).toISOString() + dm + ',';


		}else if(schema.fields[ff].type.indexOf('json')>-1){
		    //json
		    if(schema.fields[ff].type.indexOf('[')===-1){
			valreq += dm + JSON.stringify(query[ff]) + dm + '::json,';	
		    }else{
			//array
			if(!query[ff]){
			    valreq += 'ARRAY[]::json[],';
			}else if(!query[ff].length){
			    valreq += 'ARRAY[]::json[],';
			}else{
			    valreq += 'ARRAY[';
			    for(var i=query[ff].length; i-->0;) valreq += dm + JSON.stringify(query[ff][i]) + dm + '::json,';
			    valreq = valreq.substr(0, valreq.length-1);
			    valreq += '],';
			}
		    }


		}else{
		    // int/bool
		    if(schema.fields[ff].type.indexOf('[')===-1){
			valreq += '' + query[ff] + ',';
		    }else{
			//array
			if(!query[ff]){
			    valreq += 'ARRAY[]::'+schema.fields[ff].type+',';
			}else if(!query[ff].length){
			    valreq += 'null,';
			}else{
			    valreq += 'ARRAY[';
			    for(var i=query[ff].length; i-->0;) valreq += query[ff][i] + ',';
			    valreq = valreq.substr(0, valreq.length-1);
			    valreq += '],';
			}
		    }
		}
	    }
	}

	//put the other fields of query into xattrs if any
	var isx = false;
	var xat = {};
	if(schemaName+'_xattrs' in query){
	    xat = query[schemaName+'_xattrs'];

	    isx = (JSON.stringify(xat).length>2)
	}

	for(var ff in query){
	    if(ff === schemaName+'_xattrs') continue;

	    if(!(ff in schema.fields)){
		// put into xattrs
		isx = true;
		xat[ff] = query[ff];
	    }
	}
	if(isx){
	    qreq += schemaName+'_xattrs,';

	    var dm = dmfig(xat);
	    valreq += dm + JSON.stringify(xat) + dm +'::json,';// json of xat
	}

	if(qreq.length === 21) return callback({err:'nodata'});

	qreq = qreq.substr(0, qreq.length-1);
	valreq = valreq.substr(0, valreq.length-1);

	var treq = qreq + valreq + ') returning *;';// option for return value

//document this
	if(options) if(options.justString) return treq;

	pg.connect(conop, function(err, client, done) {
	    if(err) return res.json({err:err});
console.log(treq);
	    client.query(treq, function(ierr, ires){
		//insert value to API_sch
		done();
		return callback(ierr, ires);
	    });
	});

    };


    pg.update = function(schemaName, input, options, callback){
	
// use schema.tableName
	var schema = schemas.db[schemaName];

	var qreq = 'update '+schema.tableName+' set ';
	var wreq = ' where ';

	var where = input.where;
	var query = input.data;
	
//slap together wreq out of the where collection
// this obv only works for string and number queries right now

//-----------------------------------------------------------------------------------------
//-----------------------------------------------------------------------------------------
// THIS IS WHERE TO PUT DEPTH READING
//-----------------------------------------------------------------------------------------
//-----------------------------------------------------------------------------------------


	for(var ff in where){
	    if(typeof where[ff] === 'string') wreq += ff + '=\'' + where[ff] + '\' and ';
	    if(typeof where[ff] === 'number') wreq += ff + '=' + where[ff] + ' and ';
	}
	wreq = wreq.substr(0, wreq.length-4);

	// maybe only select what's being updated
// use schema.tableName
	var sreq = 'select * from '+schema.tableName+wreq+';';

// select the record, which for now should be unique

	pg.connect(conop, function(err, client, done) {
	    if(err) return res.json({err:err});
	    client.query(sreq, function(serr, sres){

		if(!sres.rows.length){

		    done();

 // check if insert is allowed
		    if(options.noinsert){
			return callback({err:'noent', where:where});
		    }

		    //put query and where together
		    var qq = {};
		    for(var ff in query) qq[ff] = query[ff];
		    for(var ff in where) qq[ff] = where[ff];

		    return pg.insert(schemaName, qq, options, callback);
		    //return callback({err:'noent'});
		}

		var doc = sres.rows[0];

		//extend this for multidim arrays?
		for(ff in query){
		    if(ff === schemaName+'_xattrs') continue;
		    if(!(ff in schema.fields)) continue;
		    qreq += ff + '=';
		    var dm = dmfig(query[ff]);

		    if(schema.fields[ff].type.indexOf('varchar')>-1){
			//string
			//if empty string put null
			if(!query[ff]){
			    qreq += 'null,';
			    continue;
			}else if(!query[ff].length){
			    qreq += 'null,';
			    continue;
			}

			if(schema.fields[ff].type.indexOf('[')===-1){
			    qreq += dm + query[ff] + dm + ',';
			}else{
			    //array
			    if(!query[ff].length){
				qreq += 'ARRAY[]::'+schema.fields[ff].type+',';
			    }else{
				qreq += 'ARRAY[';
				for(var i=query[ff].length; i-->0;) qreq += dm + query[ff][i] + dm + ',';
				qreq = qreq.substr(0, qreq.length-1);
				qreq += '],';
			    }
			}


		    }else if(schema.fields[ff].type === 'timestamp'){
			//timestamp
			qreq += dm + query[ff] + dm + ',';
			
		    }else if(schema.fields[ff].type.indexOf('json')>-1){
			//json
			if(schema.fields[ff].type.indexOf('[')===-1){
			    qreq += dm + JSON.stringify(query[ff]) + dm + '::json,';	
			}else{
			    //array
			    if(!query[ff].length){
				qreq += 'ARRAY[]::json[],';
			    }else{
				qreq += 'ARRAY[';
				for(var i=query[ff].length; i-->0;) qreq += dm + JSON.stringify(query[ff][i]) + dm + '::json,';
				qreq = qreq.substr(0, qreq.length-1);
				qreq += '],';
			    }
			}
			
			
		    }else{
			// int/bool
			if(schema.fields[ff].type.indexOf('[')===-1){
			    qreq += '' + query[ff] + ',';
			}else{
			    //array
			    if(!query[ff]){
				qreq += 'null,';
			    }else if(!query[ff].length){
				qreq += 'null,';
			    }else{
				qreq += 'ARRAY[';
				for(var i=query[ff].length; i-->0;) qreq += query[ff][i] + ',';
				qreq = qreq.substr(0, qreq.length-1);
				qreq += '],';
			    }
			}
		    }
		}

		//put the other fields of query into xattrs if any
		var isx = false;
		var xat = doc[schemaName+'_xattrs'];
		for(var ff in query){
		    if(ff === schemaName+'_xattrs') continue;
		    if(!(ff in schema.fields)){
			// put into xattrs
			isx = true;
			if(xat === null) xat = {};
			xat[ff] = query[ff];
		    }
		}
		if(isx){
		    qreq += schemaName+'_xattrs=';
		    //determine delimiter
		    var dm = dmfig(xat);
		    qreq += dm + JSON.stringify(xat) + dm +'::json,';// json of xat
		}

		if(qreq.length === 21) return callback({err:'nodata'});

		qreq = qreq.substr(0, qreq.length-1);

		var treq = qreq + wreq + ' returning *;';// option for return value

		client.query(treq, function(ierr, ires){
		    //insert value to API_sch
		    done();
		    return callback(ierr, ires);
		});
	    });
	});
    };

    pg.read = function(schemaName, query, options, callback){

	// build a string (json op the xattrs), make a query

	var schema = schemas.db[schemaName];

// only read fields in options.fields?
// use schema.tableName
	var qreq = 'select * from '+schema.tableName;
	var wreq = ' where ';

	for(var ff in query){
	    //int and string is easy as long as it is in the schema
	    // anything inside an array or json or not in the schema (in xattrs::json) more thinky
	    if(ff in schema.fields){
		if(typeof query[ff] === 'string') wreq += ff + '=\'' + query[ff] + '\' and ';
		else if(typeof query[ff] === 'number') wreq += ff + '=' + query[ff] + ' and ';
		//from array or json
	    }else{
		// from json


//-----------------------------------------------------------------------------------------
//-----------------------------------------------------------------------------------------
// THIS IS WHERE TO PUT DEPTH READING
//-----------------------------------------------------------------------------------------
//-----------------------------------------------------------------------------------------
		
	    }
	}
	
	wreq = wreq.substr(0, wreq.length-4);

	if(wreq === ' wh') wreq = '';

	var treq = qreq + wreq + ';';

	pg.connect(conop, function(err, client, done) {
	    if(err) return res.json({err:err});
	    client.query(treq, function(err, result) {
	
		//loop through result.rows[i].xattrs[ff] -> result.rows[i][ff]
		for(var i=result.rows.length; i-->0;){
		    if(!(schemaName+'_xattrs' in result.rows[i])) continue;
		    for(var ff in result.rows[i][schemaName+'_xattrs']){
			result.rows[i][ff] = result.rows[i][schemaName+'_xattrs'][ff];
		    }
		    delete result.rows[i][schemaName+'_xattrs'];
		}
		done();
		return callback(err, (result||{rows:[]}).rows);
	    });

	});
	
    };


    pg.boot = function(req,res){

	pg.connect(conop, function(err, client, done) {
	    if(err) return res.json({err:err});

	    var rs = 0;
	    for(var tt in schemas.db) ++rs;
	    var rc = rs;

	    var errs = [];
	    
	    for(var tt in schemas.db){
		
		(function(sn){// sn === tt

		    var sc = schemas.db[sn];

		    client.query('select * from '+sc.tableName, function(err, oldrowres) {
			if(err) console.log(err);
			client.query('drop table '+sc.tableName, function(err, result){
			    if(err) console.log(err);
			    
			    var oldrows = (oldrowres||{rows:[]}).rows;
			    
			    var qq = 'create table if not exists '+sc.tableName+' (';
			    for(var ff in sc.fields){
				qq += ff +' '+ sc.fields[ff].type+',';
			    }
			    for(var ff in schemas.defaultFields){
				qq += sn+'_'+ff +' '+ schemas.defaultFields[ff].type+',';
			    }
			    qq = qq.substr(0,qq.length-1) + ');';

			    // make the request
			    (function(qu, oldrows){
				client.query(qu, function(err, result) {
				    if(err){
					errs.push({err:err, query:qu});
					console.log(err);
				    }
				    var rem = oldrows.length;

				    if(!rem) if(!--rc){
					done();
		// think about returning successes and errors
					if(errs.length) return res.json({errs:errs});
					return res.json({db:schemas.db});
				    }

				    for(var i=oldrows.length; i-->0;){
					(function(d){
					    db.insert(sn, d, {}, function(err, ires){
						if(err){
						    errs.push({err:err});
						    console.log(err);
						}
						//count?
						if(!--rem) if(!--rc){
						    done();
	// think about returning successes and errors
						    if(errs.length) return res.json({errs:errs});
						    return res.json({db:schemas.db});
						}
					    });
					})(oldrows[i]);
				    }

				});
			    })(qq, oldrows);
			})
		    });
		})(tt);
	    }
	});
    };

    return pg;
}
