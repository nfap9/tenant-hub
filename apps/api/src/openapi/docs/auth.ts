import { z } from 'zod';
import {
  loginInput,
  registerInput,
  updatePasswordInput,
} from '../../routes/auth.js';
import {
  badRequestResponse,
  bearerSecurity,
  conflictResponse,
  dataResponse,
  messageResponse,
  registry,
  unauthorizedResponse,
  userSchema,
} from '../registry.js';

const tag = '认证';

const authPayload = dataResponse(
  z.object({
    user: userSchema,
    token: z.string().describe('JWT 登录凭证'),
  })
);

registry.registerPath({
  method: 'post',
  path: '/api/auth/register',
  tags: [tag],
  summary: '用户注册',
  description: '校验手机号、用户名和密码，创建用户并返回登录 token',
  request: {
    body: { content: { 'application/json': { schema: registerInput } } },
  },
  responses: {
    200: {
      description: '注册成功',
      content: { 'application/json': { schema: authPayload } },
    },
    400: badRequestResponse,
    409: conflictResponse,
  },
});

registry.registerPath({
  method: 'post',
  path: '/api/auth/login',
  tags: [tag],
  summary: '用户登录',
  description: '校验手机号和密码，返回用户信息及 JWT',
  request: {
    body: { content: { 'application/json': { schema: loginInput } } },
  },
  responses: {
    200: {
      description: '登录成功',
      content: { 'application/json': { schema: authPayload } },
    },
    400: badRequestResponse,
    401: unauthorizedResponse,
  },
});

registry.registerPath({
  method: 'get',
  path: '/api/auth/me',
  tags: [tag],
  summary: '获取当前用户',
  description: '获取当前登录用户信息及其所属组织列表',
  security: bearerSecurity,
  responses: {
    200: {
      description: '当前用户信息及组织成员列表',
      content: {
        'application/json': {
          schema: dataResponse(
            z.unknown().describe('用户信息（含 memberships 组织成员列表）')
          ),
        },
      },
    },
    401: unauthorizedResponse,
  },
});

registry.registerPath({
  method: 'post',
  path: '/api/auth/password',
  tags: [tag],
  summary: '修改密码',
  description: '修改当前登录用户密码，修改后原有 token 失效',
  security: bearerSecurity,
  request: {
    body: { content: { 'application/json': { schema: updatePasswordInput } } },
  },
  responses: {
    200: {
      description: '密码已更新',
      content: {
        'application/json': { schema: messageResponse('操作结果提示') },
      },
    },
    400: badRequestResponse,
    401: unauthorizedResponse,
  },
});
