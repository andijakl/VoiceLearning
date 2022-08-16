"use strict";

const config = require("./config.js");
const util = require("./util");
const dbHandler = require("./dbHandler.js");
const trainingHandler = require("./trainingHandler.js");

// TODO: bring getMainLanguage() to util.

const SetFirstNameApiHandler = {
    canHandle(handlerInput) {
        return util.isApiRequest(handlerInput, "SetFirstName");
    },
    async handle(handlerInput) {
        //console.log("Api Request [SetFirstName]: ", JSON.stringify(handlerInput.requestEnvelope.request, null, 2));
        // Get attributes
        const sessionAttributes = handlerInput.attributesManager.getSessionAttributes();
        const persistentAttributes = await handlerInput.attributesManager.getPersistentAttributes();
        const args = util.getApiArguments(handlerInput);
        const studentName = args.firstNameArgument;

        // Update attributes
        sessionAttributes.state = config.states.CHOOSE_COURSE;
        persistentAttributes.studentName = studentName;

        const availableTrainings = await dbHandler.getTrainingNamesForSpeech(getMainLanguage());

        let response = {
            apiResponse: {
                firstName: studentName,
                courseList: availableTrainings
            }
        };

        // Save persistent attributes
        handlerInput.attributesManager.setPersistentAttributes(persistentAttributes);
        await handlerInput.attributesManager.savePersistentAttributes();
        handlerInput.attributesManager.setSessionAttributes(sessionAttributes);

        //console.log("Api Response [SetFirstName]: ", JSON.stringify(response, null, 2));
        return response;
    }
};


const StartTrainingApiHandler = {
    canHandle(handlerInput) {
        return util.isApiRequest(handlerInput, "StartTraining");
    },
    async handle(handlerInput) {
        console.log("Api Request [StartTraining]: ", JSON.stringify(handlerInput.requestEnvelope.request, null, 2));

        // Get attributes
        const sessionAttributes = handlerInput.attributesManager.getSessionAttributes();
        const persistentAttributes = await handlerInput.attributesManager.getPersistentAttributes();
        //const userId = Alexa.getUserId(handlerInput.requestEnvelope);

        // First get our request entity and grab the training name passed in the API call
        const args = util.getApiArguments(handlerInput);
        const userTrainingName = args.courseNameArgument;

        // Match slot value with available courses and get its ID from the DB
        const selectedTrainingInfo = await trainingHandler.selectTraining(userTrainingName, persistentAttributes, getMainLanguage());
        if (selectedTrainingInfo !== null) {
            // Training selected successfully
            console.log("Found training!");

            // Hand over to traditional intent handler to run the actual training.
            return {
                directives: [{
                    type: "Dialog.DelegateRequest",
                    target: "skill",
                    period: {
                        until: "EXPLICIT_RETURN"
                    },
                    updatedRequest: {
                        type: "IntentRequest",
                        intent: {
                            name: "ChooseCourseIntent",
                            "slots": {
                                "course": {
                                    "name": "course",
                                    "value": userTrainingName
                                }
                            }
                        }
                    }
                }],
                apiResponse: {}
            };
            // let introOutput = handlerInput.t("SELECTED_COURSE_START_TRAINING", {
            //     currentTrainingName: persistentAttributes.currentTrainingName
            // });
            // // Get question
            // ({speakOutput, repromptOutput} = await trainingHandler.startNewTraining(userId, sessionAttributes, persistentAttributes, handlerInput, getMainLanguage()));
            // speakOutput = introOutput + " " + speakOutput;
        } else {
            // Unable to match slot to training in DB
            console.log("Unable to match slot to training in DB");
            // speakOutput = handlerInput.t("ERROR_COURSE_NOT_FOUND", {
            //     userTrainingName: userTrainingName
            // });
            // const availableTrainings = await dbHandler.getTrainingNamesForSpeech(getMainLanguage());
            // repromptOutput = handlerInput.t("AVAILABLE_COURSES_REPROMPT", {
            //     availableTrainings: availableTrainings
            // });
            // speakOutput += " " + repromptOutput;
        }

        let response = {
            apiResponse: {
                returnedCoursesProperty: persistentAttributes.currentTrainingName
            }
        };

        handlerInput.attributesManager.setPersistentAttributes(persistentAttributes);
        await handlerInput.attributesManager.savePersistentAttributes();
        handlerInput.attributesManager.setSessionAttributes(sessionAttributes);

        //console.log("Api Response [StartTraining]: ", JSON.stringify(response, null, 2));
        return response;
    }
};


const ListTrainingsApiHandler = {
    canHandle(handlerInput) {
        return util.isApiRequest(handlerInput, "ListTrainings");
    },
    async handle(handlerInput) {
        console.log("Api Request [ListTrainings]: ", JSON.stringify(handlerInput.requestEnvelope.request, null, 2));
        // First get our request entity and grab the color passed in the API call
        //const args = util.getApiArguments(handlerInput);
        //const color = args.color;
        const availableTrainings = await dbHandler.getTrainingNamesForSpeech(getMainLanguage());

        let response = {
            apiResponse: {
                returnedCoursesProperty: availableTrainings
            }
        };
        console.log("Api Response [ListTrainings]: ", JSON.stringify(response, null, 2));
        return response;
    }
};


module.exports = {
    SetFirstNameApiHandler,
    StartTrainingApiHandler,
    ListTrainingsApiHandler
};
