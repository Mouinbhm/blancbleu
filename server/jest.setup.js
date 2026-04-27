const winston = require('winston');
winston.configure({ transports: [] });
jest.spyOn(console, 'error').mockImplementation(() => {});
