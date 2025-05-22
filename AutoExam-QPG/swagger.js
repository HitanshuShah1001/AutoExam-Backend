// swagger.js (ES Module format)
import swaggerJsdoc from 'swagger-jsdoc';
import swaggerDefinition from './swaggerDef.js';

const options = {
    definition: swaggerDefinition,
    // "apis" should point to the files where you'll eventually place JSDoc comments
    apis: [
        './routes/*.js',    // e.g., all route files
        './controllers/*.js', // you can include controllers as well
    ],
};

export const swaggerSpec = swaggerJsdoc(options);