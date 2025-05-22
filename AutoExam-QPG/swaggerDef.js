// swaggerDef.js (ES Module format)
export default {
    openapi: '3.0.0',
    info: {
        title: 'GoTutorless API',
        version: '1.0.0',
        description: 'API documentation for GoTutorless',
    },
    servers: [
        {
            url: 'https://api.gotutorless.com',  // Production URL
            description: 'Production server',
        },
        {
            url: 'http://localhost:3000',        // Local dev URL
            description: 'Local development server',
        },
    ],
    tags: [
        {
            name: 'questionPaper',
            description: 'Endpoints for creating and managing question papers',
        },
        {
            name: 'question',
            description: 'Endpoints for creating and managing questions',
        },
        {
            name: 'blueprint',
            description: 'Endpoints for creating and managing blueprint data',
        },
        {
            name: 'chat',
            description: 'Endpoints for creating, retrieving, and deleting chats',
        },
        {
            name: 'message',
            description: 'Endpoints for creating messages and fetching paginated messages',
        },
        {
            name: 'user',
            description: 'Endpoints for user data updates',
        },
    ],
};