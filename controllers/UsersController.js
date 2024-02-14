/* eslint-disable import/no-named-as-default */
import sha1 from 'sha1';
import Queue from 'bull/lib/queue';
import dbClient from '../utils/db';

const userQueue = new Queue('email sending');

export default class UsersController {
  static async postNew(req, res) {
    const userEmailAddress = req.body ? req.body.email : null;
    const userPassword = req.body ? req.body.password : null;

    if (!userEmailAddress) {
      res.status(400).json({ error: 'Missing email' });
      return;
    }
    if (!userPassword) {
      res.status(400).json({ error: 'Missing password' });
      return;
    }
    const userEntity = await (await dbClient.usersCollection()).findOne({ email: userEmailAddress });

    if (userEntity) {
      res.status(400).json({ error: 'Already exist' });
      return;
    }
    const insertionInfo = await (await dbClient.usersCollection())
      .insertOne({ email: userEmailAddress, password: sha1(userPassword) });
    const userId = insertionInfo.insertedId.toString();

    userQueue.add({ userId });
    res.status(201).json({ email: userEmailAddress, id: userId });
  }

  static async getMe(req, res) {
    const { user } = req;

    res.status(200).json({ email: user.email, id: user._id.toString() });
  }
}
