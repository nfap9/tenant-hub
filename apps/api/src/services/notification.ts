import { prisma } from '../config/prisma.js';

export async function createNotification({
  organizationId,
  userId,
  type,
  title,
  content,
  link,
}: {
  organizationId: string;
  userId: string;
  type: string;
  title: string;
  content: string;
  link?: string;
}) {
  return prisma.notification.create({
    data: {
      organizationId,
      userId,
      type,
      title,
      content,
      link,
    },
  });
}
