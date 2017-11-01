'use strict';
const periodic = require('periodicjs');
const periodicInit = require('periodicjs/lib/init');
const Promisie = require('promisie');
// const pluralize = require('pluralize');
const logger = periodic.logger;
const model = require('./model');
let dynamicCoredataDatabases={};
let dynamicCoredataModels = {};
let allDynamicDbs = [];
let allDynamicModels = [];
let loadedRouters = new Set();

function connectDynamicDatabases() {
  // const util= require('util')
  // console.log({ periodicInit });
  // console.log('periodic.datas.keys()', periodic.datas.keys());
  return new Promise((resolve, reject) => {
    try {
      dynamicCoredataDatabases = periodic.datas.get('dynamicdb_coredatadb');
      dynamicCoredataModels = periodic.datas.get('dynamicdb_coredatamodel');
      getAllDBs()
        .then(dbs => { 
          // console.log(util.inspect( dbs,{depth:4 }));
          const formattedDBs = dbs.map(db => formatDBforLoad({ database: db }));
          return Promisie.each(formattedDBs, 5, initializeDB);
        })
        .then(dbs => {
          logger.verbose(`Connected databases: ${dbs.map(db => `${db.database_name}(${db.type})`).join(', ')}`);
          if (periodic.extensions.has('periodicjs.ext.reactapp')) {
            const reactappLocals = periodic.locals.extensions.get('periodicjs.ext.reactapp');
            const reactapp = reactappLocals.reactapp();
            const dataRouters = reactappLocals.data.getDataCoreController();
            
            Promisie.all(reactappLocals.controllerhelper.pullConfigurationSettings(), reactappLocals.controllerhelper.pullComponentSettings())
            .then(() => {
              logger.silly('RELOADED MANIFEST SETTINGS ');
            })
              .catch(logger.silly.bind(logger, 'settings error'));
            // let dbroutes = dbs.reduce(,db => loadedRouters.indexOf(db.database_name));
            
            let dbroutes = dbs.reduce((result, db) => { 
              let coredatamodels = db.core_data_models.map(model => `dcd_${db.database_name}_${model.name}`);
              let missingModels = coredatamodels.filter(coredatamodel => !loadedRouters.has(coredatamodel));
              // console.log({ coredatamodels, missingModels });
              result.push(...missingModels);
              return result;
            }, []);
            // console.log({ dbroutes });
            if (dbroutes.length) {
              logger.silly('adding routes for', { dbroutes });
              dbroutes.forEach(dbr => {
                const dbrrouter = dataRouters.get(dbr);
                periodic.app.use(`${reactapp.manifest_prefix}contentdata`, dbrrouter.router);
                loadedRouters.add(dbr);
              })
              // loadedRouters.add(...dbroutes);
              logger.debug('adding new routers', { loadedRouters });
            } else {
              logger.debug('already added all routes',{loadedRouters})
            }
          }
          resolve(dbs);
          // periodic.app.use('/testnewroute', (req, res) => { res.send({ status: 'added dynamically' }) })
            // console.log('periodic.datas.keys()', periodic.datas.keys());
          // console.log('periodic.app',periodic.app)
        })
        .catch(reject);  
    } catch (e) {
      reject(e);
    }
  });
}

function getAllDBs() {
  return new Promise((resolve, reject) => {
    try {
      return resolve(dynamicCoredataDatabases.query({}))
    } catch (e) {
      return reject(e);
    }
  });
}

function formatDBforLoad(options) {
  const { database } = options;
  return Object.assign({}, database, {
    db: database.type,
    periodic_db_name: `dcd_${database.database_name}`,
    db_config_type: 'extension',
    extension: 'periodicjs.ext.dynamic_core_data',
    controller: {
      default: {
        responder: {
          adapter: 'json'
        },
        protocol: {
          api: 'rest',
          adapter: 'http'
        }
      }
    },
  });
}

function initializeDB(db) {
  return new Promise((resolve, reject) => {
    try {
      const connectSettingsDB = periodicInit.config.connectDB.bind(periodic);
      if (db.core_data_models.length) {
        Promise.all(db.core_data_models.map(modelObj => model.createModelFile({ database: db, model: modelObj })))
        .then(setupmodels => {
          resolve(connectSettingsDB(db));
        }).catch(reject);
      } else {
        resolve(model.ensureModelDir({ database: db }));
      }
    } catch (e) {
      reject(e);
    }
  });
}

module.exports = {
  connectDynamicDatabases,
  getAllDBs,
};