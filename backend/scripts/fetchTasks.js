const { TaskPdf } = require('../models');

const getTasks = async (id) => {
    try {
        const tasks = await TaskPdf.findAll({
            where: {
                resourceId: id,
            }
        });
        return tasks
    } catch (error) {
        console.error("Error fetching tasks: ", error);
        return [];  
    }
}

module.exports = { getTasks };
