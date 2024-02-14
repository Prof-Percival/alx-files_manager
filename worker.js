/* eslint-disable import/no-named-as-default */
import { writeFile } from 'fs';
import { promisify } from 'util';
import Queue from 'bull/lib/queue';
import imgThumbnail from 'image-thumbnail';
import mongoDBCore from 'mongodb/lib/core';
import dbClient from './utils/db';
import Mailer from './utils/mailer';

const writeFileAsync = promisify(writeFile);
const fileQueue = new Queue('thumbnail generation');
const userQueue = new Queue('email sending');

/**
 * Generates the thumbnail of an image with a given width size.
 * @param {String} filePath The location of the original file.
 * @param {number} size The width of the thumbnail.
 * @returns {Promise<void>}
 */
const generateThumbnail = async (filePath, size) => {
  const buffer = await imgThumbnail(filePath, { width: size });
  console.log(`Generating file: ${filePath}, size: ${size}`);
  return writeFileAsync(`${filePath}_${size}`, buffer);
};

fileQueue.process(async (job, done) => {
  const fileId = job.data.fileId || null;
  const userId = job.data.userId || null;

  if (!fileId) {
    throw new Error('Missing fileId');
  }
  if (!userId) {
    throw new Error('Missing userId');
  }
  console.log('Processing', job.data.name || '');
  const fileObject = await (await dbClient.filesCollection())
    .findOne({
      _id: new mongoDBCore.BSON.ObjectId(fileId),
      userId: new mongoDBCore.BSON.ObjectId(userId),
    });
  if (!fileObject) {
    throw new Error('File not found');
  }
  const fileSizes = [500, 250, 100];
  Promise.all(fileSizes.map((fileSize) => generateThumbnail(fileObject.localPath, fileSize)))
    .then(() => {
      done();
    });
});

userQueue.process(async (job, done) => {
  const userId = job.data.userId || null;

  if (!userId) {
    throw new Error('Missing userId');
  }
  const userEntity = await (await dbClient.usersCollection())
    .findOne({ _id: new mongoDBCore.BSON.ObjectId(userId) });
  if (!userEntity) {
    throw new Error('User not found');
  }
  console.log(`Welcome ${userEntity.email}!`);
  try {
    const mailSubject = 'Welcome to ALX-Files_Manager by Prof-Percival';
    const mailContent = [
      '<div>',
      '<h3>Hello {{user.name}},</h3>',
      'Welcome to <a href="https://github.com/Prof-Percival/alx-files_manager">',
      'ALX-Files_Manager</a>, ',
      'a simple file management API built with Node.js by ',
      '<a href="https://github.com/Prof-Percival">Prof. Percival</a>. ',
      'We hope it meets your needs.',
      '</div>',
    ].join('');
    Mailer.sendMail(Mailer.buildMessage(userEntity.email, mailSubject, mailContent));
    done();
  } catch (err) {
    done(err);
  }
});
