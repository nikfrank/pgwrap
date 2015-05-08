module.exports = {

    person:[{
	person_hash:'person0',
	name:'Nox Freebird',
	fbid:'3',
	country:'il',
	teachers:['person1', 'person2'],
	schools:['school0']
    },{
	person_hash:'person1',
	name:'Nik Frank',
	fbid:'4',
	country:'il',
	teachers:['person2'],
	schools:['school0', 'school1']
    },{
	person_hash:'person2',
	name:'Yaakov Moishe',
	fbid:'5',
	country:'us',
	teachers:[],
	schools:['school0', 'school1']
    }],

    school:[{
	school_hash:'school0',
	name:'javascript school',
	country:'il',
	teachers:['person1','person2'],
	students:['person0']
    },{
	school_hash:'school1',
	name:'web arch school',
	country:'us',
	teachers:['person2'],
	students:['person1']
    }],

    testres:[{
	student:'person0',
	teacher:'person1',
	school:'school0',
	date:(new Date(2015,2,10,9,59,59)),
	grade:80
    },{
	student:'person0',
	teacher:'person2',
	school:'school0',
	date:(new Date(2015,2,12,11,59,59)),
	grade:82
    },{
	student:'person1',
	teacher:'person2',
	school:'school1',
	date:(new Date(2015,3,20,9,59,59)),
	grade:70
    }]
};