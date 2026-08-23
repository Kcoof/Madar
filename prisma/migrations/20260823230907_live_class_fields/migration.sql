/*
  Warnings:

  - You are about to drop the column `providerRoomId` on the `LiveClass` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "LiveClass" DROP COLUMN "providerRoomId",
ADD COLUMN     "endedAt" TIMESTAMP(3),
ADD COLUMN     "micGrants" TEXT[],
ADD COLUMN     "roomName" TEXT,
ADD COLUMN     "rtmpUrl" TEXT,
ADD COLUMN     "streamKey" TEXT;
