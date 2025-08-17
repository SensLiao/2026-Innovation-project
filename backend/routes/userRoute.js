import express from 'express';
import { getUsers, getUserByID, addUser, updateUser, deleteUser } from '../controllers/userController.js';
const router = express.Router();

router.get('/', getUsers); //get all users
router.get('/:id', getUserByID); //get user by ID
router.post('/', addUser);
router.put('/:id', updateUser);
router.delete('/:id', deleteUser);

export default router;