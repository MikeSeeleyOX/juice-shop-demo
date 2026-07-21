/*
 * Copyright (c) 2014-2023 Bjoern Kimminich & the OWASP Juice Shop contributors.
 * SPDX-License-Identifier: MIT
 */

import fs = require('fs')
import path = require('path')
import { Request, Response, NextFunction } from 'express'

import { UserModel } from '../models/user'
const utils = require('../lib/utils')
const security = require('../lib/insecurity')
const request = require('request')
const logger = require('../lib/logger')

module.exports = function profileImageUrlUpload () {
  return (req: Request, res: Response, next: NextFunction) => {
    if (req.body.imageUrl !== undefined) {
      const url = req.body.imageUrl
      const sanitizedUrl = url
      if (sanitizedUrl.match(/(.)*solve\/challenges\/server-side(.)*/) !== null) req.app.locals.abused_ssrf_bug = true
      const loggedInUser = security.authenticatedUsers.get(req.cookies.token)
      if (loggedInUser) {
        const sanitizedUserId = path.basename(loggedInUser.data.id.toString())
        const imageRequest = request
          .get(sanitizedUrl)
          .on('error', function (err: unknown) {
            UserModel.findByPk(loggedInUser.data.id).then(async (user: UserModel | null) => { return await user?.update({ profileImage: sanitizedUrl }) }).catch((error: Error) => { next(error) })
            logger.warn(`Error retrieving user profile image: ${utils.getErrorMessage(err)}; using image link directly`)
          })
          .on('response', function (res: Response) {
            if (res.statusCode === 200) {
              const ext = ['jpg', 'jpeg', 'png', 'svg', 'gif'].includes(sanitizedUrl.split('.').slice(-1)[0].toLowerCase()) ? sanitizedUrl.split('.').slice(-1)[0].toLowerCase() : 'jpg'
              const sanitizedExt = path.basename(ext)
              const filePath = path.join('frontend', 'dist', 'frontend', 'assets', 'public', 'images', 'uploads', `${sanitizedUserId}.${sanitizedExt}`)
              imageRequest.pipe(fs.createWriteStream(filePath))
              UserModel.findByPk(loggedInUser.data.id).then(async (user: UserModel | null) => { return await user?.update({ profileImage: path.join('/assets/public/images/uploads', `${sanitizedUserId}.${sanitizedExt}`) }) }).catch((error: Error) => { next(error) })
            } else UserModel.findByPk(loggedInUser.data.id).then(async (user: UserModel | null) => { return await user?.update({ profileImage: sanitizedUrl }) }).catch((error: Error) => { next(error) })
          })
      } else {
        next(new Error('Blocked illegal activity by ' + req.socket.remoteAddress))
      }
    }
    res.location(process.env.BASE_PATH + '/profile')
    res.redirect(process.env.BASE_PATH + '/profile')
  }
}