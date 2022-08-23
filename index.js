import axios from 'axios'
import { mergeDeep, debounce } from './utils.js'

class HTTPHeaterCooler {
  // default config
  static defaults = {
    // http endpoints
    endpoint: 'http://localhost:1337',
    // display unit
    celsius: true,
    // properties
    properties: {
      rotationSpeed: {
        minValue: 1,
        maxValue: 3,
        minStep: 1
      },
      coolingThresholdTemperature: {
        minValue: 17,
        maxValue: 30,
        minStep: 1
      },
      heatingThresholdTemperature: {
        minValue: 17,
        maxValue: 30,
        minStep: 1
      },
      targetHeaterCoolerState: {
        minValue: 0,
        maxValue: 2,
        minStep: 1,
        validValues: [1, 2]
      }
    }
  }
  constructor (log, config, api) {
    // expose vars
    this.log = log
    this.api = api
    this.config = mergeDeep(HTTPHeaterCooler.defaults, config)

    // shortcuts
    this.Service = this.api.hap.Service
    this.Characteristic = this.api.hap.Characteristic

    // heaterCooler state
    this.state = {
      // power & mode
      active: this.Characteristic.Active.INACTIVE,
      currentHeaterCoolerState: this.Characteristic.CurrentHeaterCoolerState.INACTIVE,
      targetHeaterCoolerState: this.Characteristic.TargetHeaterCoolerState.COOL,

      // fan
      rotationSpeed: 2,

      // temp
      currentTemperature: 25,
      coolingThresholdTemperature: 25,
      heatingThresholdTemperature: 25,
      temperatureDisplayUnits: this.Characteristic.TemperatureDisplayUnits.CELSIUS,
    }

    // create heaterCooler service
    this.service = new this.Service.HeaterCooler(config.name)

    // create information service
    this.informationService = new this.Service.AccessoryInformation()
    this.informationService.setCharacteristic(this.Characteristic.Manufacturer, 'eo')

    // create axios instance
    this.axios = axios.create({
      baseURL: this.config.endpoint,
      timeout: 5 * 1000
    })
  }

  sync () {
    // create request params
    const params = {}

    // params power
    params.power = this.state.active === this.Characteristic.Active.ACTIVE ? 1 : 0

    // params mode
    if (this.state.targetHeaterCoolerState === this.Characteristic.TargetHeaterCoolerState.COOL) {
      params.mode = 1
      params.temp = this.state.coolingThresholdTemperature
    } else if (this.state.targetHeaterCoolerState === this.Characteristic.TargetHeaterCoolerState.HEAT) {
      params.mode = 2
      params.temp = this.state.heatingThresholdTemperature
    }

    // params fan
    params.fan = this.state.rotationSpeed

    this.log.debug('synchronizing parameters')
    this.axios.get('/remote', { params })
  }

  get (key) {
    return this.state[key]
  }

  set (key, val) {
    this.log.debug('setting ' + key + ' to ' + val)
    this.state[key] = val

    debounce(this.sync.bind(this), 500)()
  }

  notImplemented () {
    throw new Error('not implemented!')
  }

  getServices () {
    // create handlers for required characteristics
    this.service.getCharacteristic(this.Characteristic.Active)
      .onGet(this.get.bind(this, 'active'))
      .onSet(this.set.bind(this, 'active'))

    this.service.getCharacteristic(this.Characteristic.CurrentHeaterCoolerState)
      .onGet(this.get.bind(this, 'currentHeaterCoolerState'))

    this.service.getCharacteristic(this.Characteristic.TargetHeaterCoolerState)
      .setProps(this.config.properties.targetHeaterCoolerState)
      .onGet(this.get.bind(this, 'targetHeaterCoolerState'))
      .onSet(this.set.bind(this, 'targetHeaterCoolerState'))

    this.service.getCharacteristic(this.Characteristic.RotationSpeed)
      .setProps(this.config.properties.rotationSpeed)
      .onGet(this.get.bind(this, 'rotationSpeed'))
      .onSet(this.set.bind(this, 'rotationSpeed'))

    this.service.getCharacteristic(this.Characteristic.CurrentTemperature)
      .onGet(this.get.bind(this, 'currentTemperature'))

    this.service.getCharacteristic(this.Characteristic.CoolingThresholdTemperature)
      .setProps(this.config.properties.coolingThresholdTemperature)
      .onGet(this.get.bind(this, 'coolingThresholdTemperature'))
      .onSet(this.set.bind(this, 'coolingThresholdTemperature'))

    this.service.getCharacteristic(this.Characteristic.HeatingThresholdTemperature)
      .setProps(this.config.properties.heatingThresholdTemperature)
      .onGet(this.get.bind(this, 'heatingThresholdTemperature'))
      .onSet(this.set.bind(this, 'heatingThresholdTemperature'))

    this.service.getCharacteristic(this.Characteristic.TemperatureDisplayUnits)
      .onGet(this.get.bind(this, 'temperatureDisplayUnits'))
      .onSet(this.notImplemented.bind(this))

    return [this.informationService, this.service]
  }
}

export default function (homebridge) {
  homebridge.registerAccessory('@eymengunay/homebridge-http-heater-cooler', 'HTTPHeaterCooler', HTTPHeaterCooler)
}