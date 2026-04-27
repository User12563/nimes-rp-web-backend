import express from "express";
import passport from "passport";
import { Strategy as DiscordStrategy } from "passport-discord";
import StaffUser from "../models/StaffUser.js";
import { ROLE_PERMISSIONS } from "../config/permissions.js";
import { getMemberRoles } from "../discord/utils/member.js";
import axios from "axios";

const router = express.Router();

const GUILD_ID = process.env.DISCORD_GUILD_ID || "1380978534167613611"; 
const DISCORD_ROLES = {
    SUPER_ADMIN: ["1492493841696034867", "1381159290030522459"], 
    ADMIN: ["1381159291372830820"],                                 
    MODERATEUR: ["1381159289179082752"]                            
};

passport.serializeUser((user, done) => done(null, user.id));
passport.deserializeUser(async (id, done) => {
    try {
        const user = await StaffUser.findById(id);
        done(null, user);
    } catch (err) {
        done(err, null);
    }
});

passport.use(new DiscordStrategy({
    clientID: process.env.DISCORD_CLIENT_ID,
    clientSecret: process.env.DISCORD_CLIENT_SECRET,
    callbackURL: process.env.DISCORD_CALLBACK_URL,
    scope: ['identify', 'guilds'],
    passReqToCallback: true // ✅ INDISPENSABLE pour récupérer l'IP via l'objet req
}, async (req, accessToken, refreshToken, profile, done) => {
    try {
        const isOnGuild = profile.guilds.some(g => g.id === GUILD_ID);
        if (!isOnGuild) return done(null, false, { message: "Vous n'êtes pas sur le serveur Nîmes-RP" });

        // --- RÉCUPÉRATION DE L'IP ---
        const userIP = req.headers['x-forwarded-for']?.split(',')[0] || req.socket.remoteAddress;

        const userRoles = await getMemberRoles(profile.id);
        let finalRole = null;

        if (userRoles.some(r => DISCORD_ROLES.SUPER_ADMIN.includes(r))) {
            finalRole = "SUPER_ADMIN";
        } else if (userRoles.some(r => DISCORD_ROLES.ADMIN.includes(r))) {
            finalRole = "ADMIN";
        } else if (userRoles.some(r => DISCORD_ROLES.MODERATEUR.includes(r))) {
            finalRole = "MODERATEUR";
        }

        if (!finalRole) return done(null, false, { message: "Accès refusé : Aucun rôle Staff détecté." });

        const discordAvatarUrl = profile.avatar 
            ? `https://cdn.discordapp.com/avatars/${profile.id}/${profile.avatar}.png`
            : null;

        let currentRobloxAvatar = null;
        const existingUser = await StaffUser.findOne({ discordId: profile.id });
        
        if (existingUser && existingUser.isLinked && existingUser.robloxId) {
            try {
                const robloxAvatarRes = await axios.get(
                    `https://thumbnails.roproxy.com/v1/users/avatar-headshot?userIds=${existingUser.robloxId}&size=420x420&format=Png&isCircular=false`,
                    { timeout: 3000 }
                );
                if (robloxAvatarRes.data?.data?.length > 0) {
                    currentRobloxAvatar = robloxAvatarRes.data.data[0].imageUrl;
                }
            } catch (error) {
                currentRobloxAvatar = existingUser.robloxAvatar;
            }
        }

        const updateData = {
            username: profile.username,
            avatar: discordAvatarUrl,
            role: finalRole, 
            lastLogin: Date.now(),
            lastServiceIP: userIP // ✅ SAUVEGARDE DE L'IP DANS LE MODÈLE
        };

        if (currentRobloxAvatar) {
            updateData.robloxAvatar = currentRobloxAvatar;
        }

        const user = await StaffUser.findOneAndUpdate(
            { discordId: profile.id },
            updateData,
            { upsert: true, returnDocument: 'after' }
        );

        return done(null, user);
    } catch (err) {
        return done(err, null);
    }
}));

// --- ROUTES ---

router.get("/login", passport.authenticate("discord"));

router.get("/callback", passport.authenticate("discord", {
    failureRedirect: "https://www.nimesrp.fr/login?error=unauthorized",
    session: true
}), (req, res) => {
    req.session.save((err) => {
        if (err) return res.redirect("https://www.nimesrp.fr/login?error=server");
        if (!req.user?.isLinked) return res.redirect("https://www.nimesrp.fr/link-roblox");
        res.redirect("https://www.nimesrp.fr/dashboard");
    });
});

router.get("/me", async (req, res) => {
    if (!req.isAuthenticated() || !req.user) return res.status(401).json({ error: "Session expirée" });
    const user = req.user;
    
    res.json({
        id: user.discordId,
        username: user.username,
        avatar: user.avatar,
        role: user.role,
        isLinked: user.isLinked,
        robloxUsername: user.robloxUsername,
        robloxId: user.robloxId,
        robloxAvatar: user.robloxAvatar,
        status: user.status,
        notes: user.notes,
        warns: user.warns || [],
        createdAt: user.createdAt,
        lastLogin: user.lastLogin,
        lastServiceIP: user.lastServiceIP, // ✅ RENVOI DE L'IP AU DASHBOARD
        totalServiceTime: user.totalServiceTime, // ✅ TEMPS TOTAL
        weeklyServiceTime: user.weeklyServiceTime, // ✅ TEMPS HEBDO
        isBanned: user.isBanned,
        permissions: ROLE_PERMISSIONS[user.role] || []
    });
});

router.post("/logout", (req, res) => {
    req.logout((err) => {
        if (err) return res.status(500).json({ error: "Erreur logout" });
        req.session.destroy();
        res.clearCookie('nimes_session', { domain: '.nimesrp.fr', path: '/' }); 
        res.json({ message: "Logged out" });
    });
});

export default router;