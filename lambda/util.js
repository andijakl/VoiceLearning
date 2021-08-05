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

const Alexa = require("ask-sdk-core");
/**
 * Helper method to find if a request is for a certain apiName. 
 */
module.exports.isApiRequest = (handlerInput, apiName) => {
    try {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === "Dialog.API.Invoked"
            && handlerInput.requestEnvelope.request.apiRequest.name === apiName;
    } catch (e) {
        console.log("Error occurred: ", e);
        return false;
    }
};

/**
 * Helper method to get API request entity from the request envelope.
 */
module.exports.getApiArguments = (handlerInput) => {
    try {
        return handlerInput.requestEnvelope.request.apiRequest.arguments;
    } catch (e) {
        console.log("Error occurred: ", e);
        return false;
    }
};

/**
 * Helper method to get API resolved entity from the request envelope.
 */
module.exports.getApiSlots = (handlerInput) => {
    try {
        return handlerInput.requestEnvelope.request.apiRequest.slots;
    } catch (e) {
        console.log("Error occurred: ", e);
        return false;
    }
};

module.exports.isAplSupported = function isAplSupported(handlerInput) {
    return Alexa.getSupportedInterfaces(handlerInput.requestEnvelope)["Alexa.Presentation.APL"];
};

module.exports.addAplIfSupported = function addAplIfSupported(handlerInput, token, document, data = {}) {
    if (module.exports.isAplSupported(handlerInput)) {
        handlerInput.responseBuilder
            .addDirective({
                "type": "Alexa.Presentation.APL.RenderDocument",
                "token": token,
                "document": document,
                "datasources": data
            });
    }
};

module.exports.getAplADirective = function getAplADirective(token, document, data = {}) {
    return {
        "type": "Alexa.Presentation.APLA.RenderDocument",
        "token": token,
        "document": document,
        "datasources": data
    };
};
