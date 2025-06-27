const express = require('express');
const Task = require('../models/Task');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// All routes require authentication
router.use(authenticateToken);

// Get dashboard statistics
router.get('/stats', async (req, res) => {
  try {
    const userId = req.user._id;

    // Get task counts by status
    const taskStats = await Task.aggregate([
      { $match: { userId } },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      }
    ]);

    // Get priority distribution
    const priorityStats = await Task.aggregate([
      { $match: { userId } },
      {
        $group: {
          _id: '$priority',
          count: { $sum: 1 }
        }
      }
    ]);

    // Get tasks by category
    const categoryStats = await Task.aggregate([
      { $match: { userId } },
      {
        $group: {
          _id: '$category',
          count: { $sum: 1 }
        }
      }
    ]);

    // Get recent activity (last 7 days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const recentActivity = await Task.aggregate([
      {
        $match: {
          userId,
          createdAt: { $gte: sevenDaysAgo }
        }
      },
      {
        $group: {
          _id: {
            $dateToString: {
              format: '%Y-%m-%d',
              date: '$createdAt'
            }
          },
          count: { $sum: 1 }
        }
      },
      { $sort: { '_id': 1 } }
    ]);

    // Get overdue tasks
    const overdueTasks = await Task.countDocuments({
      userId,
      dueDate: { $lt: new Date() },
      status: { $ne: 'completed' }
    });

    // Get tasks due today
    const today = new Date();
    const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);

    const tasksDueToday = await Task.countDocuments({
      userId,
      dueDate: {
        $gte: startOfDay,
        $lt: endOfDay
      },
      status: { $ne: 'completed' }
    });

    // Format the response
    const stats = {
      tasks: {
        total: taskStats.reduce((sum, stat) => sum + stat.count, 0),
        todo: taskStats.find(s => s._id === 'todo')?.count || 0,
        inProgress: taskStats.find(s => s._id === 'in-progress')?.count || 0,
        completed: taskStats.find(s => s._id === 'completed')?.count || 0
      },
      priority: {
        high: priorityStats.find(s => s._id === 'high')?.count || 0,
        medium: priorityStats.find(s => s._id === 'medium')?.count || 0,
        low: priorityStats.find(s => s._id === 'low')?.count || 0
      },
      categories: categoryStats.map(cat => ({
        name: cat._id,
        count: cat.count
      })),
      activity: recentActivity.map(day => ({
        date: day._id,
        count: day.count
      })),
      alerts: {
        overdue: overdueTasks,
        dueToday: tasksDueToday
      }
    };

    res.json({ stats });
  } catch (error) {
    console.error('Dashboard stats error:', error);
    res.status(500).json({ error: 'Failed to fetch dashboard statistics' });
  }
});

// Get recent tasks
router.get('/recent', async (req, res) => {
  try {
    const recentTasks = await Task.find({ userId: req.user._id })
      .sort({ updatedAt: -1 })
      .limit(10)
      .select('title status priority category updatedAt');

    res.json({ tasks: recentTasks });
  } catch (error) {
    console.error('Recent tasks error:', error);
    res.status(500).json({ error: 'Failed to fetch recent tasks' });
  }
});

module.exports = router;