'use strict';
const periodic = require('periodicjs');
const utilities = require('./utilities');
const logger = periodic.logger;
module.exports = () => {
  periodic.status.on('configuration-complete', (status) => {
    utilities.connect.connectDynamicDatabases()
      .then(() => {
        logger.silly('loaded dynamic databases');
      })
      .catch(logger.error);
  });
  
  return Promise.resolve(true);
}