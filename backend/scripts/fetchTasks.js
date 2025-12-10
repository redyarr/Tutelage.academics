const { TaskPdf } = require('../models');

const getTasks = async (id, resourceType) => {
    try {
        const tasks = await TaskPdf.findAll({
            where: {
                resourceId: id,
                resourceType: resourceType
            }
        });
        return tasks
    } catch (error) {
        console.error("Error fetching tasks: ", error);
        return [];  
    }
}

module.exports = { getTasks };
