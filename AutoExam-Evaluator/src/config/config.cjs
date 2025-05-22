// src/config/config.cjs
module.exports = {
  development: {
    username: 'asedb',
    password: 'Xc*ul-Kc3HLMVwYv$IEtTVjlG76*',
    database: 'asedb',
    host: 'asedb.ch4mgguc8sl1.eu-north-1.rds.amazonaws.com',
    dialect: 'postgres',
    dialectOptions: {
      ssl: {
        require: true,
        rejectUnauthorized: false, // for RDS
      },
    },
  },
};
