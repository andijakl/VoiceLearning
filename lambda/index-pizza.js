/**
 * Copyright 2020 Amazon.com, Inc. and its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: LicenseRef-.amazon.com.-AmznSL-1.0
 * 
 * Licensed under the Amazon Software License (the "License").
 * You may not use this file except in compliance with the License.
 * A copy of the License is located at
 * 
 * http://aws.amazon.com/asl/
 * 
 * or in the "license" file accompanying this file. This file is distributed
 * on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either
 * express or implied. See the License for the specific language governing
 * permissions and limitations under the License.
**/
'use strict';
const Alexa         = require('ask-sdk');
const i18next       = require('i18next');
const sprintf       = require('sprintf-js').sprintf;
const _             = require('lodash');

// Localization strings
const resources     = require('./resources')
// Utility for parsing intent requests and API requests
const requestUtils  = require('./requestUtils');
// Static list of menu items with some helper functions
const menu          = require('./menu');

// APL docs
const welcome_apl   = require('./launch_request.json');

const states = {
    PROMPTED_FOR_DAILY_SPECIALS: 'PROMPTED_FOR_DAILY_SPECIALS',
    PROMPTED_TO_ORDER_DAILY_SPECIAL: 'PROMPTED_TO_ORDER_DAILY_SPECIAL',
    PROMPTED_TO_CUSTOMIZE : 'PROMPTED_TO_CUSTOMIZE',
    PROMPTED_TO_ADD_TO_ORDER: 'PROMPTED_TO_ADD_TO_ORDER',
    PROMPTED_TO_ORDER_SPECIAL : 'PROMPTED_TO_ORDER_SPECIAL',
    PROMPTED_TO_CUSTOMIZE_SPECIAL_PIZZA : 'PROMPTED_TO_CUSTOMIZE_SPECIAL_PIZZA'
};
// *****************************************************************************
// Launch request handler.
// *****************************************************************************
const LaunchHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'LaunchRequest';
    },
    /**
     * Launch request handler. 
     * on launching the skill, user gets the 'speechOutput' message of this handler. 
     * If user is silent or speaks something which is unrelated then user is reprompted with repromptOutput
     *
     * @param handlerInput {HandlerInput}
     * @returns {Response}
     */
    async handle(handlerInput) {
        const personId = requestUtils.getPersonId(handlerInput);
        const sessionAttributes = handlerInput.attributesManager.getSessionAttributes();
        const {in_progress} = sessionAttributes;
        
        let speakOutput, reprompt;
        // if they had 'in flight' orders that had not been moved to ordered.
        if(in_progress){
            if(personId){
                speakOutput = handlerInput.t('WELCOME_PERSONALIZED', {
                    personId: personId,
                    prompt: handlerInput.t('WELCOME_BACK')
                });
            } else {
                speakOutput = handlerInput.t('WELCOME_BACK');
            }
            reprompt = handlerInput.t('WELCOME_BACK_REPROMPT');
            // the in-progress prompt asks them if they'd like to customize anything
            // let's set that state for the Yes/No Intent Handlers
            sessionAttributes.state = states.PROMPTED_TO_CUSTOMIZE;
        } else {
            // no in progress orders
            let {day, period} = await requestUtils.getDayAndPeriod(handlerInput);
            reprompt = handlerInput.t('WELCOME_REPROMPT');
            if (personId) {
                // Speaker is recognized, so greet by name
                speakOutput = handlerInput.t('WELCOME_PERSONALIZED', {
                    personId: personId,
                    prompt: handlerInput.t('WELCOME', {
                        day: day,
                        period: period
                    })
                });
            } else {
                // Speaker is not recognized; give a generic greeting asking if they would like to hear our specials
                speakOutput = handlerInput.t('WELCOME', {
                    day: day,
                    period: period
                });
            }
            // give context to yes/no response by saving state
            sessionAttributes.state = states.PROMPTED_FOR_DAILY_SPECIALS;
        }
        if (Alexa.getSupportedInterfaces(handlerInput.requestEnvelope)['Alexa.Presentation.APL']){
            handlerInput.responseBuilder.addDirective({
                type: 'Alexa.Presentation.APL.RenderDocument',
                token: "welcomeToken",
                document: welcome_apl
            });
        }
        return handlerInput.responseBuilder
                .speak(speakOutput)
                .reprompt(reprompt)
                .getResponse();
    }
};
/**
 * AMAZON.YesIntentHandler. 
 * 
 * Used in response to 
 *  - being prompted to hear the daily specials
 *  - ordering a daily special
 *  
 * @param handlerInput {HandlerInput}
 * @returns {Response}
 */
const YesIntentHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest'
            && Alexa.getIntentName(handlerInput.requestEnvelope) === 'AMAZON.YesIntent'
    },
    async handle(handlerInput) {
        let speakOutput, reprompt;
        const sessionAttributes = handlerInput.attributesManager.getSessionAttributes();
        let {day, period} = await requestUtils.getDayAndPeriod(handlerInput);
        // if we just prompted them for specials
        if (sessionAttributes.state == states.PROMPTED_FOR_DAILY_SPECIALS){
            console.log("Getting daily special for " + period + " on " + day);
            // copying to new object to not mess up downstream storage of object in session
            let spoken_special = JSON.parse(JSON.stringify(menu.getDailySpecialForPeriod(day, period)));
            console.log('Daily special: ' + JSON.stringify(spoken_special));
            if (period === "lunch"){
                speakOutput = handlerInput.t('DAILY_LUNCH_SPECIAL', {
                    day: day,
                    size: spoken_special.pizza.size,
                    crust: spoken_special.pizza.crust,
                    cheese: spoken_special.pizza.cheese,
                    toppingsList: menu.makeSpeakableList(spoken_special.pizza.toppingsList),
                    salad: spoken_special.salad,
                    drinks: spoken_special.drinks,
                    cost: spoken_special.cost
                });
            } else {
                speakOutput = handlerInput.t('DAILY_DINNER_SPECIAL', {
                    day: day,
                    size: spoken_special.pizza.size,
                    crust: spoken_special.pizza.crust,
                    cheese: spoken_special.pizza.cheese,
                    toppingsList: menu.makeSpeakableList(spoken_special.pizza.toppingsList),
                    salad: spoken_special.salad,
                    side: spoken_special.side,
                    dessert: spoken_special.dessert,
                    drinks: spoken_special.drinks,
                    cost: spoken_special.cost
                });
            }
            reprompt = handlerInput.t('DAILY_SPECIAL_REPROMPT',{
                day: day,
                period: period
            });
            sessionAttributes.state = states.PROMPTED_TO_ORDER_DAILY_SPECIAL;
        } else if(sessionAttributes.state == states.PROMPTED_TO_ORDER_DAILY_SPECIAL){
            let daily_special = menu.getDailySpecialForPeriod(day, period);
            // the user answered 'yes' to ordering the daily special
            speakOutput = handlerInput.t('ORDER_DAILY_SPECIAL',{
                day: day,
                period: period
            });
            reprompt = handlerInput.t('ORDER_DAILY_SPECIAL_REPROMPT',{
                day: day,
                period: period
            });
            // let the system know we prompted to customize the pizza or salad
            sessionAttributes.state = states.PROMPTED_TO_ADD_TO_ORDER;

            // lets save this order as in-progress
            sessionAttributes.in_progress = daily_special;
        } else if (sessionAttributes.state == states.PROMPTED_TO_ADD_TO_ORDER){
            // the user answered 'yes' to customizing something, lets find out which
            speakOutput = handlerInput.t('ADD_TO_ORDER',);
            reprompt = handlerInput.t('ADD_TO_ORDER_REPROMPT');
        } else if (sessionAttributes.state == states.PROMPTED_TO_ORDER_SPECIAL){
            // the user answered yes to ordering one of the special pizzas
            speakOutput = handlerInput.t('PROMPT_TO_CUSTOMIZE_SPECIAL',{
                name: sessionAttributes.specialName
            });
            reprompt = handlerInput.t('PROMPT_TO_CUSTOMIZE_SPECIAL_REPROMPT');
            sessionAttributes.state = states.PROMPTED_TO_CUSTOMIZE_SPECIAL_PIZZA;
          
            // lets save this order as in-progress
            sessionAttributes.in_progress = {special : menu.getSpecialPizzaDetails(sessionAttributes.specialName)};
        } else if (sessionAttributes.state == states.PROMPTED_TO_CUSTOMIZE_SPECIAL_PIZZA){
            // user answered yes to customizing a pizza
            // send this to Alexa Conversations for customize special pizza
            let name = sessionAttributes.in_progress.special.name;
            // if we dont have a special name, lets ask for it again
            if (!name){
                speakOutput = handlerInput.t('GET_SPECIAL_PIZZA_NAME');
                repromt = handlerInput.t('GET_SPECIAL_PIZZA_NAME_REPROMPT');
            } else {
                return handlerInput.responseBuilder
                    .addDirective({
                        type: 'Dialog.DelegateRequest',
                        target: 'AMAZON.Conversations',
                        period: {
                            until: 'EXPLICIT_RETURN' 
                        },
                        updatedRequest: {
                            type: 'Dialog.InputRequest',
                            input: {
                                name: 'customizePizzaReferenceSpecial',
                                slots: {
                                    name: {
                                        name : 'name',
                                        value: name
                                    }
                                }
                            }
                        }
                    })
                    .getResponse();
            }
        }
        return handlerInput.responseBuilder
            .speak(speakOutput)
            .reprompt(reprompt)
            .getResponse();
    }
};
const AddPizzaReferenceSpecialToOrderIntentHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest'
            && Alexa.getIntentName(handlerInput.requestEnvelope) === 'AddPizzaReferenceSpecialToOrderIntent'
    },
    handle(handlerInput){
        let speakOutput, reprompt;
        console.log("In AddPizzaReferenceSpecialToOrderIntentHandler");

        const specialSlot = Alexa.getSlot(handlerInput.requestEnvelope, 'special');
        const firstAuthority = _.first(_.get(specialSlot, 'resolutions.resolutionsPerAuthority'));
        const special = _.first(_.get(firstAuthority, 'values')).value.name;
        
        // the user answered yes to ordering one of the special pizzas
        speakOutput = handlerInput.t('PROMPT_TO_CUSTOMIZE_SPECIAL',{
            name: special
        });
        reprompt = handlerInput.t('PROMPT_TO_CUSTOMIZE_SPECIAL_REPROMPT');
        let sessionAttributes = handlerInput.attributesManager.getSessionAttributes();
        sessionAttributes.state = states.PROMPTED_TO_CUSTOMIZE_SPECIAL_PIZZA;
    
        // lets save this order as in-progress
        sessionAttributes.in_progress = {special : menu.getSpecialPizzaDetails(special)};
        return handlerInput.responseBuilder
            .speak(speakOutput)
            .reprompt(reprompt)
            .getResponse();
    }
}
const StartOverIntentHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest'
            && Alexa.getIntentName(handlerInput.requestEnvelope) === 'StartOverIntent'
    },
    handle(handlerInput){
        // they answered 'start over' when asked to customize/resume their in progress order
        // lets delete that state if saved
        const sessionAttributes = handlerInput.attributesManager.getSessionAttributes();
        if (sessionAttributes.state == states.PROMPTED_TO_CUSTOMIZE){
            if (sessionAttributes.in_progress){
                delete sessionAttributes.in_progress;
            }
        }
        let speakOutput, reprompt;
        speakOutput = handlerInput.t('PROMPT_FOR_ACTION');
        reprompt = handlerInput.t('REMPROMPT_FOR_ACTION');
        return handlerInput.responseBuilder
            .speak(speakOutput)
            .reprompt(reprompt)
            .getResponse();
    }
}

const WhatsInMyOrderIntentHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest'
            && Alexa.getIntentName(handlerInput.requestEnvelope) === 'WhatsInMyOrderIntent'
    },
    handle(handlerInput){
        // They are asking what's in their current order
        const sessionAttributes = handlerInput.attributesManager.getSessionAttributes();
        const {in_progress} = sessionAttributes;
        let speakOutput, reprompt;
        // they dont have an in progress order
        if(!in_progress){
            speakOutput = handlerInput.t('NO_CURRENT_ORDER', {
                orderText: menu.generateOrderText(in_progress)
            });
            reprompt = handlerInput.t('NO_CURRENT_ORDER_REPROMPT');
        } else {
            speakOutput = handlerInput.t('CURRENT_ORDER', {
                orderText: menu.generateOrderText(in_progress)
            });
            reprompt = handlerInput.t('CURRENT_ORDER_REPROMPT');
        }
        return handlerInput.responseBuilder
            .speak(speakOutput)
            .reprompt(reprompt)
            .getResponse();
    }
}
 /**
 * AMAZON.NoIntentHandler. 
 * 
 * Used in response to 
 *  - being prompted to hear the daily specials
 *  - ordering a daily special
 *  
 * @param handlerInput {HandlerInput}
 * @returns {Response}
 */
const NoIntentHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest'
            && Alexa.getIntentName(handlerInput.requestEnvelope) === 'AMAZON.NoIntent'
    },
    handle(handlerInput) {
        let speakOutput, reprompt;
        const sessionAttributes = handlerInput.attributesManager.getSessionAttributes();
        // if we just prompted them for specials, ordering daily special, or customizing special pizza
        if (sessionAttributes.state == states.PROMPTED_FOR_DAILY_SPECIALS || 
                sessionAttributes.state == states.PROMPTED_TO_ORDER_DAILY_SPECIAL ||
                sessionAttributes.state == states.PROMPTED_TO_ORDER_SPECIAL){
            speakOutput = handlerInput.t('PROMPT_FOR_ACTION');
            reprompt = handlerInput.t('REMPROMPT_FOR_ACTION');
        } 
        // if we prompted them to customize and they said no
        if (sessionAttributes.state == states.PROMPTED_TO_ADD_TO_ORDER || 
                sessionAttributes.state == states.PROMPTED_TO_CUSTOMIZE_SPECIAL_PIZZA){
            _.defaults(sessionAttributes, {
                orders: []
            });
            const {in_progress} = sessionAttributes;
            sessionAttributes.orders.push({ 
                date : new Date().toISOString(),
                order: in_progress
            });
            delete sessionAttributes.in_progress;
            speakOutput = handlerInput.t('PLACE_ORDER', {
                orderText: menu.generateOrderText(in_progress)
            });
            reprompt = handlerInput.t('PLACE_ORDER_REPROMPT');
        } 
        return handlerInput.responseBuilder
            .speak(speakOutput)
            .reprompt(reprompt)
            .getResponse();
    }
};
const ContinueOrderIntentHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest'
            && Alexa.getIntentName(handlerInput.requestEnvelope) === 'ContinueOrderIntent'
    },

    /**
     * ContinueOrderIntent handler. 
     * 
     * Triggered when the user has an existing order in their persisted attributes that hasnt been moved to orders
     *
     * @param handlerInput {HandlerInput}
     * @returns {Response}
     */
    handle(handlerInput) {
        // lets get the in_progress order
        const sessionAttributes = handlerInput.attributesManager.getSessionAttributes();
        const {in_progress} = sessionAttributes;
        let orderText = menu.generateOrderText(in_progress);
        let speakOutput, reprompt;
        // let's repeat their order to confirm its still what they want
        speakOutput = handlerInput.t('REPEAT_ORDER_AND_ADD_SOMETHING', { 
            orderText : orderText
        });
        reprompt = handlerInput.t('REPEAT_ORDER_AND_ADD_SOMETHING_REPROMPT');
        
        return handlerInput.responseBuilder
            .speak(speakOutput)
            .reprompt(reprompt) 
            .getResponse();
    }
};
const OrderIntentHandler = {
    canHandle(handlerInput) {
        const request = handlerInput.requestEnvelope.request;
        return request.type === 'IntentRequest' && request.intent.name === 'OrderIntent';
    },
    handle(handlerInput) {
        console.log("In OrderIntentHandler");
        const sessionAttributes = handlerInput.attributesManager.getSessionAttributes();
        _.defaults(sessionAttributes, {
            orders: []
        });
        const {in_progress} = sessionAttributes;
        let orderText = menu.generateOrderText(in_progress);
        sessionAttributes.orders.push({ 
            date : new Date().toISOString(),
            order: in_progress
        });  
        let speakOutput = handlerInput.t('PLACE_ORDER', {
            orderText : orderText
        });
        let reprompt = handlerInput.t('PLACE_ORDER_REPROMPT');
        return handlerInput.responseBuilder
            .speak(speakOutput)
            .reprompt(reprompt)
            .getResponse();
    }
}
const AddSomethingIntentHandler = {
    canHandle(handlerInput) {
        const request = handlerInput.requestEnvelope.request;
        return request.type === 'IntentRequest' && request.intent.name === 'AddSomethingIntent';
    },
    /**
     * The user asked to add something to their order. Depending on what they asked to add
     * lets give them a list of options.
     *
     * @param handlerInput {HandlerInput}
     * @returns {Response}
     */
    handle(handlerInput) {
        console.log("In AddSomethingIntentHandler");
        let speakOutput, reprompt;
        const itemSlot = Alexa.getSlot(handlerInput.requestEnvelope, 'item');
        const firstAuthority = _.first(_.get(itemSlot, 'resolutions.resolutionsPerAuthority'));
        const item = _.first(_.get(firstAuthority, 'values')).value.name;
        if (item === 'pizza'){
            speakOutput = handlerInput.t('PIZZA_ORDER_OPTIONS');
            reprompt = handlerInput.t('PIZZA_ORDER_OPTIONS_REPROMPT');
        } else if (item === 'salad'){
            speakOutput = handlerInput.t('SALAD_ORDER_OPTIONS',{
                salads : menu.makeSpeakableList(menu.getSalads())
            });
            reprompt = handlerInput.t('SALAD_ORDER_OPTIONS_REPROMPT');
        } else if (item === 'side'){
            speakOutput = handlerInput.t('SIDE_ORDER_OPTIONS',{
                sides : menu.makeSpeakableList(menu.getSides())
            });
            reprompt = handlerInput.t('SIDE_ORDER_OPTIONS_REPROMPT');
        } else if (item === 'drink'){
            speakOutput = handlerInput.t('DRINK_ORDER_OPTIONS',{
                drinks : menu.makeSpeakableList(menu.getDrinks())
            });
            reprompt = handlerInput.t('DRINK_ORDER_OPTIONS_REPROMPT');
        } else if (item === 'dessert'){
            speakOutput = handlerInput.t('DESSERT_ORDER_OPTIONS',{
                desserts : menu.makeSpeakableList(menu.getDesserts())
            });
            reprompt = handlerInput.t('DESSERT_ORDER_OPTIONS_REPROMPT');
        } else {
            speakOutput = handlerInput.t('UNRECOGONIZED_ITEM');
            reprompt = handlerInput.t('UNRECOGONIZED_ITEM_REPROMPT');
        }
        return handlerInput.responseBuilder
            .speak(speakOutput)
            .reprompt(reprompt)
            .getResponse();
    }
}
const HearPizzaReferenceSpecialsIntentHandler = {
    canHandle(handlerInput) {
        const request = handlerInput.requestEnvelope.request;
        return request.type === 'IntentRequest' && request.intent.name === 'HearPizzaReferenceSpecialsIntent';
    },
    /**
     * User asks to hear the specials, prompt to hear details or add to order
     *
     * @param handlerInput {HandlerInput}
     * @returns {Response}
     */
    handle(handlerInput) {
        console.log("In HearPizzaReferenceSpecialsIntentHandler");
        let speakOutput, reprompt;
        // make a deep copy of the object and return a 'speakable' list
        let specials = menu.makeSpeakableList(JSON.parse(JSON.stringify(menu.getPizzaReferenceSpecials())));
        speakOutput = handlerInput.t('PIZZA_REFERENCE_SPECIALS', {
            specials: specials
        });
        reprompt = handlerInput.t('PIZZA_REFERENCE_SPECIALS_REPROMPT');
        const sessionAttributes = handlerInput.attributesManager.getSessionAttributes();
        sessionAttributes.state = states.PROMPTED_TO_HEAR_BLUE_SHIFT_SPECIAL_DETAILS;
        return handlerInput.responseBuilder
            .speak(speakOutput)
            .reprompt(reprompt)
            .getResponse();
    },
};
const HelpIntentHandler = {
    canHandle(handlerInput) {
        const request = handlerInput.requestEnvelope.request;
        return request.type === 'IntentRequest' && request.intent.name === 'AMAZON.HelpIntent';
    },
    /**
     * User asked for help
     *
     * @param handlerInput {HandlerInput}
     * @returns {Response}
     */
    handle(handlerInput) {
        console.log("In HelpIntentHandler");
        let speakOutput, reprompt;
       
        speakOutput = handlerInput.t('HELP_PROMPT');
        reprompt = handlerInput.t('GENERIC_REPROMPT');
        return handlerInput.responseBuilder
            .speak(speakOutput)
            .reprompt(reprompt)
            .getResponse();
    },
};
const HearSpecialDetailsIntentHandler = {
    canHandle(handlerInput) {
        const request = handlerInput.requestEnvelope.request;
        return request.type === 'IntentRequest' && request.intent.name === 'HearSpecialDetailsIntent';
    },
    /**
     * User asks to hear the specials, prompt to hear details or add to order
     * Since these utterances are the same for clarifying which special they want to customize, 
     * we will check for that state as well
     *
     * @param handlerInput {HandlerInput}
     * @returns {Response}
     */
    handle(handlerInput) {
        console.log("In HearSpecialDetailsIntentHandler");
        let speakOutput, reprompt;
        // get the name of the special
        const specialNameSlot = Alexa.getSlot(handlerInput.requestEnvelope, 'special');
        const firstAuthority = _.first(_.get(specialNameSlot, 'resolutions.resolutionsPerAuthority'));
        const specialName = _.first(_.get(firstAuthority, 'values')).value.name;

        console.log(JSON.stringify(specialNameSlot));
        console.log("heard [" + specialName + "] as the special name")
        // if they didnt pass us a name and just asked for details 'on a special', lets prompt again for name
        if (!specialName){
            let specials = menu.makeSpeakableList(JSON.parse(JSON.stringify(menu.getPizzaReferenceSpecials())));
            speakOutput = handlerInput.t('REPEAT_PIZZA_REFERENCE_SPECIALS_AND_GET_NAME', {
                specials: specials
            });
            reprompt = handlerInput.t('REPEAT_PIZZA_REFERENCE_SPECIALS_AND_GET_NAME_REPROMPT');
            return handlerInput.responseBuilder
                .speak(speakOutput)
                .reprompt(reprompt)
                .getResponse()
        }
        // if they passed in a name, but its not a special
        if (!menu.getPizzaReferenceSpecials().includes(specialName)){
            let specials = menu.makeSpeakableList(JSON.parse(JSON.stringify(menu.getPizzaReferenceSpecials())));
            speakOutput = handlerInput.t('REPEAT_PIZZA_REFERENCE_SPECIALS_AND_GET_NAME', {
                specials: specials,
                error: "Sorry, I dont recognize " + specialName + " as one of our specials."
            });
            reprompt = handlerInput.t('REPEAT_PIZZA_REFERENCE_SPECIALS_AND_GET_NAME_REPROMPT');
            return handlerInput.responseBuilder
                .speak(speakOutput)
                .reprompt(reprompt)
                .getResponse()

        }
        // if we get here, we have a valid special name
        const sessionAttributes = handlerInput.attributesManager.getSessionAttributes();
        // if we are re-prompting them for the special name and they indicated they wanted to customize
        if (sessionAttributes.state == states.PROMPTED_TO_CUSTOMIZE_SPECIAL_PIZZA){
            return handlerInput.responseBuilder
                .addDirective({
                    type: 'Dialog.DelegateRequest',
                    target: 'AMAZON.Conversations',
                    period: {
                        until: 'EXPLICIT_RETURN' 
                    },
                    updatedRequest: {
                        type: 'Dialog.InputRequest',
                        input: {
                            name: 'customizePizzaReferenceSpecial',
                            slots: {
                                name: {
                                    name: 'name',
                                    value: specialName
                                }
                            }
                        }
                    }
                })
                .getResponse();
        }
        const special = menu.getSpecialPizzaDetails(specialName);
        speakOutput = handlerInput.t('PIZZA_REFERENCE_SPECIAL_DETAILS_PROMPT_TO_ORDER', {
            name : special.name,
            qty : special.qty,
            size : special.pizza.size,
            crust : special.pizza.crust,
            cheese : special.pizza.cheese,
            toppings : menu.makeSpeakableList(special.pizza.toppingsList),
            cost: special.cost
        });
        reprompt = handlerInput.t('PIZZA_REFERENCE_SPECIAL_DETAILS_PROMPT_TO_ORDER_REPROMPT', {
            name: special.name
        });
        sessionAttributes.state = states.PROMPTED_TO_ORDER_SPECIAL;
        sessionAttributes.specialName = specialName;
        return handlerInput.responseBuilder
            .speak(speakOutput)
            .reprompt(reprompt)
            .getResponse();
    },
};
const BuildMyOwnPizzaIntentHandler = {
    canHandle(handlerInput) {
        const request = handlerInput.requestEnvelope.request;
        return request.type === 'IntentRequest' && request.intent.name === 'BuildMyOwnPizzaIntent';
    },
    handle(handlerInput) {
        console.log("In BuildMyOwnPizzaIntentHandler");

        // get the name of the special
        const countSlot = Alexa.getSlot(handlerInput.requestEnvelope, 'count');
        if ( countSlot && countSlot.value ){
            if (countSlot.value == 2){
                return handlerInput.responseBuilder
                    .addDirective({
                        type: 'Dialog.DelegateRequest',
                        target: 'AMAZON.Conversations',
                        period: {
                            until: 'EXPLICIT_RETURN' 
                        },
                        updatedRequest: {
                            type: 'Dialog.InputRequest',
                            input: {
                                name: 'startTwoToppingPizzaOrder'
                            }
                        }
                    })
                    .getResponse();

            }
        }
        const sizeSlot = Alexa.getSlot(handlerInput.requestEnvelope, 'size');
        if ( sizeSlot && sizeSlot.value ){
            return handlerInput.responseBuilder
                .addDirective({
                    type: 'Dialog.DelegateRequest',
                    target: 'AMAZON.Conversations',
                    period: {
                        until: 'EXPLICIT_RETURN' 
                    },
                    updatedRequest: {
                        type: 'Dialog.InputRequest',
                        input: {
                            name: 'orderSpecificSizePizza',
                            slots: {
                                name: {
                                    name: 'size',
                                    value: sizeSlot.value
                                }
                            }
                        }
                    }
                })
                .getResponse();
        }
        return handlerInput.responseBuilder
            .addDirective({
                type: 'Dialog.DelegateRequest',
                target: 'AMAZON.Conversations',
                period: {
                    until: 'EXPLICIT_RETURN' 
                },
                updatedRequest: {
                    type: 'Dialog.InputRequest',
                    input: {
                        name: 'startPizzaOrder'
                    }
                }
            })
            .getResponse();
    }
};
const GetHoursIntentHandler = {
    canHandle(handlerInput) {
        const request = handlerInput.requestEnvelope.request;
        return request.type === 'IntentRequest' && request.intent.name === 'GetHoursIntent';
    },
    async handle(handlerInput) {
        const { requestEnvelope, serviceClientFactory, responseBuilder } = handlerInput;
        const consentToken = requestEnvelope.context.System.user.permissions && requestEnvelope.context.System.user.permissions.consentToken;
        
        if (!consentToken) {
          return responseBuilder
            .speak(handlerInput.t('PERMISSIONS_ERROR'))
            .withAskForPermissionsConsentCard(['read::alexa:device:all:address'])
            .getResponse();
        }
        try {
          const { deviceId } = requestEnvelope.context.System.device;
          const deviceAddressServiceClient = serviceClientFactory.getDeviceAddressServiceClient();
          const address = await deviceAddressServiceClient.getFullAddress(deviceId);
       
          let response;
          if (address.addressLine1 === null && address.stateOrRegion === null) {
            response = responseBuilder.speak(handlerInput.t('NO_ADDRESS_SET')).getResponse();
          } else {
            const city = address.city;
            let prompt = handlerInput.t('CLOSEST_LOCATION', {
                city: city
            });
            let reprompt = handlerInput.t('GENERIC_REPROMPT')
            response = responseBuilder.speak(prompt)
            .reprompt(reprompt)
            .getResponse();
          }
          return response;
        } catch (error) {
          if (error.name !== 'ServiceError') {
            const response = responseBuilder.speak(handlerInput.t('ERROR')).getResponse();
            return response;
          }
          throw error;
        }
      }
};
// *****************************************************************************
// This is the default intent handler to handle all intent requests.
const OtherIntentHandler = {
    canHandle(handlerInput) {
        const request = handlerInput.requestEnvelope.request;
        return request.type === 'IntentRequest' && request.intent.name !== 'GetSpecialtyPizzaListIntent' && request.intent.name !== 'BuildMyOwnPizzaIntent';
    },

    /**
     * If user says something which is not handled by the specific intent handlers, then the request should be handled by this default
     * Intent handler. This prompts the user to select one of our defined Intents. For now, GetSpecialtyPizzaListIntent and BuildMyOwnPizzaIntent
     * 
     * @param handlerInput {HandlerInput}
     * @returns {Response}
     */

    handle(handlerInput) {
        const intentName = handlerInput.requestEnvelope.request.intent.name;
        console.log('In catch all intent handler. Intent invoked: ' + intentName);
        const speechOutput = handlerInput.t('GENERIC_REPROMPT');

        return handlerInput.responseBuilder
            .speak(speechOutput)
            .reprompt(speechOutput)
            .getResponse();
    },
};
const StopIntentHandler = {
    canHandle(handlerInput) {
        const request = handlerInput.requestEnvelope.request;
        return request.type === 'IntentRequest' && request.intent.name === 'AMAZON.StopIntent';
    },
    handle(handlerInput){
        let speechOutput = handlerInput.t('EXIT');
        return handlerInput.responseBuilder
            .speak(speechOutput)
            .getResponse();
    }
}
const CancelIntentHandler = {
    canHandle(handlerInput) {
        const request = handlerInput.requestEnvelope.request;
        return request.type === 'IntentRequest' && request.intent.name === 'AMAZON.CancelIntent';
    },
    handle(handlerInput){
        let speechOutput = handlerInput.t('PROMPT_FOR_ACTION');
        let reprompt = handlerInput.t('GENERIC_REPROMPT');
        return handlerInput.responseBuilder
            .speak(speechOutput)
            .reprompt(reprompt)
            .getResponse();
    }
}
// *****************************************************************************
// Alexa Conversations API request handlers. Called by the Alexa Conversations platform when AMAZON.Conversations is the
// focused dialog manager. These can instead be specified using the private SDK with execute() methods and the skill
// builder addApiRequestHandler(). To work with the public SDK, these are written as generic request handlers.

const OrderPizza = {
    canHandle(handlerInput) {
        return requestUtils.isApiRequest(handlerInput, 'OrderPizza');
    },

    /**
     * OrderPizza API
     * Consumes: size, crust, cheese and a list of toppings
     * Returns: Valid custom pizza order from Alexa Conversations
     *
     * @param handlerInput {HandlerInput}
     * @return {Promise<Response>}
     */
    handle(handlerInput) {
        const apiArguments = requestUtils.getApiArguments(handlerInput);
        const sessionAttributes = handlerInput.attributesManager.getSessionAttributes();
        sessionAttributes.in_progress = {pizza : apiArguments};

        return {
            directives : [{
                type: 'Dialog.DelegateRequest',
                target: 'skill',
                period: {
                    until: 'EXPLICIT_RETURN'
                },
                updatedRequest: {
                    type: 'IntentRequest',
                    intent: {
                        name: 'OrderIntent',
                    }
                }}],
                apiResponse :{}
            }
        }
};
const GetPizzaReferenceSpecialDetails = {
    canHandle(handlerInput) {
        return requestUtils.isApiRequest(handlerInput, 'GetPizzaReferenceSpecialDetails');
    },
    /**
     * Returns the special pizza detail from the menu
     *
     * @param handlerInput {HandlerInput}
     * @returns {Promise<Response>}
     */
    handle(handlerInput) {
        console.log("In GetPizzaReferenceSpecialDetails API Handler");
        const apiArguments = requestUtils.getApiArguments(handlerInput);
        let special = menu.getSpecialPizzaDetails(apiArguments.name);
        return {
            apiResponse: {
                special
            }
         };
    }
};
const GetRelativeFeedingSize = {
    canHandle(handlerInput) {
        return requestUtils.isApiRequest(handlerInput, 'GetRelativeFeedingSize');
    },
    /**
     * Returns the special pizza detail from the menu
     *
     * @param handlerInput {HandlerInput}
     * @returns {Promise<Response>}
     */
    handle(handlerInput) {
        console.log("In GetRelativeFeedingSize API Handler");
        const apiArguments = requestUtils.getApiArguments(handlerInput);
        let feedingSize = menu.getFeedingSize(apiArguments.size);
        return {
            apiResponse: {
                feedingSize
            }
        };
    }
};
const OrderTwoToppingPizza = {
    canHandle(handlerInput) {
        return requestUtils.isApiRequest(handlerInput, 'OrderTwoToppingPizza');
    },
    /**
     * Returns the special pizza detail from the menu
     *
     * @param handlerInput {HandlerInput}
     * @returns {Promise<Response>}
     */
    handle(handlerInput) {
        console.log("In OrderTwoToppingPizza API Handler");
        const apiArguments = requestUtils.getApiArguments(handlerInput);
        const sessionAttributes = handlerInput.attributesManager.getSessionAttributes();
        apiArguments["cheese"] = "normal";
        apiArguments["toppingsList"] = [apiArguments.toppingone, apiArguments.toppingtwo];
        sessionAttributes.in_progress = {pizza : apiArguments};
        return {
            directives : [{
                type: 'Dialog.DelegateRequest',
                target: 'skill',
                period: {
                    until: 'EXPLICIT_RETURN'
                },
                updatedRequest: {
                    type: 'IntentRequest',
                    intent: {
                        name: 'OrderIntent',
                    }
                }}],
                apiResponse :{}
            }
    }
};
const OrderCustomizedPizzaReferenceSpecial = {
    canHandle(handlerInput) {
        return requestUtils.isApiRequest(handlerInput, 'OrderCustomizedPizzaReferenceSpecial');
    },
    /**
     * Returns the special pizza detail from the menu
     *
     * @param handlerInput {HandlerInput}
     * @returns {Promise<Response>}
     */
    async handle(handlerInput) {
        console.log("In OrderCustomizedPizzaReferenceSpecial API Handler");
        const apiArguments = requestUtils.getApiArguments(handlerInput);
        const sessionAttributes = await handlerInput.attributesManager.getSessionAttributes();
        const special = {};
        special.pizza = {};
        special.name = apiArguments.name;
        special.qty = apiArguments.qty;
        special.pizza.size = apiArguments.size;
        special.pizza.cheese = apiArguments.cheese;
        special.pizza.crust = apiArguments.crust;
        special.pizza.toppingsList = apiArguments.toppings;
        special.pizza.cost = menu.getSpecialCost(special.name);
        sessionAttributes.in_progress = special;
        return {
            directives : [{
                type: 'Dialog.DelegateRequest',
                target: 'skill',
                period: {
                    until: 'EXPLICIT_RETURN'
                },
                updatedRequest: {
                    type: 'IntentRequest',
                    intent: {
                        name: 'OrderIntent',
                    }
                }}],
                apiResponse :{}
        }
    }
};
const MenuQuestion = {
    canHandle(handlerInput) {
        return requestUtils.isApiRequest(handlerInput, 'MenuQuestion');
    },
    /**
     * Returns the special pizza detail from the menu
     *
     * @param handlerInput {HandlerInput}
     * @returns {Promise<Response>}
     */
    handle(handlerInput) {
        console.log("In API handler MenuQuestion")
        const apiArguments = requestUtils.getApiArguments(handlerInput);
        const slots = requestUtils.getApiSlots(handlerInput);
        console.log(JSON.stringify(apiArguments));
        console.log(JSON.stringify(slots));
        let optionValue = apiArguments.option;
        let optionResponse = "Your choices of ";
        if (slots){
             optionValue = slots.option.resolutions.resolutionsPerAuthority[0].values[0].value.name;
        }
        if (optionValue === 'size'){
            optionResponse += 'size are small, medium, large, and extra large';
        } else if (optionValue === 'crust'){
            optionResponse += 'crust are thin crust, deep dish, regular and brooklyn style';
        } else if (optionValue === 'cheese'){
            optionResponse += 'cheese are no cheese, light, normal, extra cheese or double cheese';
        }
        optionResponse += ", what would you like"
    
        return {
            apiResponse: {
                optionResponse
            }
        };
    }
}
// *****************************************************************************
// Generic session-ended handling logging the reason received, to help debug in error cases.

const SessionEndedRequestHandler = {
    canHandle(handlerInput) {
        return handlerInput.requestEnvelope.request.type === 'SessionEndedRequest';
    },
    handle(handlerInput) {
        console.log(`Session ended with reason: ${handlerInput.requestEnvelope.request.reason}`);
        return handlerInput.responseBuilder.getResponse();
    },
};

// *****************************************************************************
// Generic error handling to capture any syntax or routing errors. If you receive an error
// stating the request handler chain is not found, you have not implemented a handler for
// the intent being invoked or included it in the skill builder below.

const ErrorHandler = {
    canHandle() {
        return true;
    },
    handle(handlerInput, error) {
        console.error(`Error handled: ${error.message}`);
        console.error(`Error stack`, JSON.stringify(error.stack));
        console.error(`Error`, JSON.stringify(error));

        let speechOutput, reprompt;
        speechOutput = handlerInput.t('GENERIC_REPROMPT');
        reprompt = handlerInput.t('REPROMPT_FOR_ACTION');
        return handlerInput.responseBuilder
            .speak(speechOutput)
            .reprompt(reprompt)
            .getResponse();
    },
};

// *****************************************************************************
// These simple interceptors just log the incoming and outgoing request bodies to assist in debugging.

const LogRequestInterceptor = {
    process(handlerInput) {
        console.log(`REQUEST ENVELOPE = ${JSON.stringify(handlerInput.requestEnvelope)}`);
    },
};

const LogResponseInterceptor = {
    process(handlerInput, response) {
        console.log(`RESPONSE = ${JSON.stringify(response)}`);
    },
};
const LocalizationInterceptor = {
    process(handlerInput) {
        i18next
            .init({
                lng: _.get(handlerInput, 'requestEnvelope.request.locale'),
                overloadTranslationOptionHandler: sprintf.overloadTranslationOptionHandler,
                resources: resources,
                returnObjects: true
            });
 
        handlerInput.t = (key, opts) => {
            const value = i18next.t(key, {...{interpolation: {escapeValue: false}}, ...opts});
            if (Array.isArray(value)) {
                return value[Math.floor(Math.random() * value.length)]; // return a random element from the array
            } else {
                return value;
            }
        };
    }
};

// *****************************************************************************
// The SkillBuilder acts as the entry point for your skill, routing all request and response
// payloads to the handlers above. Make sure any new handlers or interceptors you've
// defined are included below. The order matters in lists: they're processed top to bottom.
module.exports.handler = Alexa.SkillBuilders.standard()
    .addRequestHandlers(        
        LaunchHandler,
        YesIntentHandler,
        NoIntentHandler,
        OrderIntentHandler,
        StartOverIntentHandler,
        AddSomethingIntentHandler,
        StopIntentHandler,
        CancelIntentHandler,
        HelpIntentHandler,
        WhatsInMyOrderIntentHandler,
        SessionEndedRequestHandler,
        GetHoursIntentHandler,
        ContinueOrderIntentHandler,
        HearPizzaReferenceSpecialsIntentHandler,
        HearSpecialDetailsIntentHandler,
        AddPizzaReferenceSpecialToOrderIntentHandler,
        BuildMyOwnPizzaIntentHandler,
        OtherIntentHandler,
        OrderPizza,
        OrderTwoToppingPizza,
        MenuQuestion,
        GetRelativeFeedingSize,
        GetPizzaReferenceSpecialDetails,
        OrderCustomizedPizzaReferenceSpecial)
    .addErrorHandlers(ErrorHandler)
    .addRequestInterceptors(LogRequestInterceptor, LocalizationInterceptor)
    .addResponseInterceptors(LogResponseInterceptor)
    .withAutoCreateTable(true)
    .withCustomUserAgent('reference-skills/pizza-reference/v1')
    .lambda();
