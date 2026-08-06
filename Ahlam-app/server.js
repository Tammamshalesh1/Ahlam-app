const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

app.use(express.static(path.join(__dirname, 'public')));

// تخزين الغرف والبيانات الفورية في الذاكرة
let activeRooms = {
    "room_1": { name: "مجلس أحلام العام 🌟", owner: "System", users: [], pk: null },
    "room_2": { name: "سهرة طرب وإبداع 🎤", owner: "System", users: [], pk: null }
};

io.on('connection', (socket) => {
    // إرسال قائمة الغرف المتاحة للمستخدم فور اتصاله
    socket.emit('update-room-list', activeRooms);

    // دخول غرفة معينة مع الـ ID
    socket.on('join-ahlam-room', ({ roomId, userId, username }) => {
        socket.join(roomId);
        socket.roomId = roomId;
        socket.userId = userId;
        socket.username = username;

        if (!activeRooms[roomId]) {
            activeRooms[roomId] = { name: `غرفة ${username}`, owner: userId, users: [], pk: null };
        }

        // إضافة المستخدم للغرفة
        activeRooms[roomId].users.push({ socketId: socket.id, userId, username });
        io.emit('update-room-list', activeRooms);
        io.to(roomId).emit('user-joined', { userId, username, users: activeRooms[roomId].users });
    });

    // نظام الرسائل النصية
    socket.on('send-room-msg', (msgText) => {
        io.to(socket.roomId).emit('receive-room-msg', {
            username: socket.username,
            userId: socket.userId,
            text: msgText
        });
    });

    // بدء تحدي الـ PK لايف بين الميكروفونات
    socket.on('start-pk-challenge', () => {
        if (socket.roomId && activeRooms[socket.roomId]) {
            activeRooms[socket.roomId].pk = { scoreA: 0, scoreB: 0 };
            io.to(socket.roomId).emit('pk-started', activeRooms[socket.roomId].pk);
        }
    });

    // إرسال الهدايا ودعم نقاط الـ PK
    socket.on('send-gift', ({ giftName, points, team }) => {
        const room = activeRooms[socket.roomId];
        if (room && room.pk) {
            if (team === 'A') room.pk.scoreA += points;
            if (team === 'B') room.pk.scoreB += points;
            io.to(socket.roomId).emit('pk-updated', room.pk);
        }
        io.to(socket.roomId).emit('gift-animated', { username: socket.username, giftName });
    });

    // عند خروج المستخدم
    socket.on('disconnect', () => {
        if (socket.roomId && activeRooms[socket.roomId]) {
            activeRooms[socket.roomId].users = activeRooms[socket.roomId].users.filter(u => u.socketId !== socket.id);
            io.to(socket.roomId).emit('user-left', { socketId: socket.id, users: activeRooms[socket.roomId].users });
            io.emit('update-room-list', activeRooms);
        }
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`تطبيق أحلام لايف يعمل على: http://localhost:${PORT}`));
