'use strict';
const AWS = require('aws-sdk');

// Configure AWS DynamoDB
//AWS.config.update({region: 'REGION'});
const DB_TABLE_TRAININGS = 'LearningAssistantTrainings';
const DB_TABLE_QUESTIONS = 'LearningAssistantQuestions';
let ddbInstance = null;


function connectToDb() {
    if (ddbInstance === null) {
        ddbInstance = new AWS.DynamoDB.DocumentClient({apiVersion: '2012-08-10'});
    }
    return ddbInstance;
}

module.exports.getTrainingList = async function getTrainingList() {
    const params = {
        TableName: DB_TABLE_TRAININGS
    };
    try {
        const db = connectToDb();
        const data = await db.scan(params).promise();
        //console.log("db get success!: " + JSON.stringify(data));
        return data.Items;
    } catch (err) {
        console.log("Error getting data from db: " + err.message);
    }
}

module.exports.getTrainingNamesForSpeech = async function getTrainingNamesForSpeech() {
    let trainings = await module.exports.getTrainingList();
    //console.log("got trainings: " + JSON.stringify(trainings));
    // Well, I'm sure there is some more elegant alternative for this in JS.
    let trainingNames = [];
    //for (let item in trainings) {
    trainings.forEach((item) => {
        trainingNames.push(item.TrainingName);
    });
    return trainingNames.join(", ");
}

module.exports.getQuestionsForTraining = async function getQuestionsForTraining(trainingId) {
    const params = {
        TableName: DB_TABLE_QUESTIONS
    };

    // TODO Implement
}