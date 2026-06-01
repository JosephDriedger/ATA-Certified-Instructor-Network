
const multer = require('multer');
const path   = require('path');
const fs     = require('fs');
const crypto = require('crypto');

// Ensure the upload directory exists at module load time.
const PROFILE_UPLOAD_DIR = path.join(__dirname, '../public/uploads/profiles');
fs.mkdirSync(PROFILE_UPLOAD_DIR, { recursive: true });

const storage = multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, PROFILE_UPLOAD_DIR),

    filename: (req, file, cb) => {
        const ext    = path.extname(file.originalname).toLowerCase();
        const uid    = req.session.userId ?? 'unknown';
        const rand   = crypto.randomBytes(6).toString('hex');
        cb(null, `${uid}_${Date.now()}_${rand}${ext}`);
    }
});

const fileFilter = (_req, file, cb) => {
    const allowed = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (allowed.includes(file.mimetype)) {
        cb(null, true);
    } else {
        cb(new multer.MulterError('LIMIT_UNEXPECTED_FILE', 'Only JPEG, PNG, and WebP images are allowed.'));
    }
};

// Wrap multer so upload errors surface as req.uploadError instead of crashing.
// Usage in routes:  router.post('/path', handleProfileUpload, validationChain, controller)
const _raw = multer({ storage, fileFilter, limits: { fileSize: 5 * 1024 * 1024 } });

const handleProfileUpload = (req, res, next) => {
    _raw.single('profilePhoto')(req, res, (err) => {
        if (err) {
            req.uploadError = err.code === 'LIMIT_FILE_SIZE'
                ? 'Profile photo must be 5 MB or smaller.'
                : err.message || 'Invalid file. Only JPEG, PNG, and WebP are accepted.';
        }
        next();
    });
};

// ── School logo upload ────────────────────────────────────────────────────

const LOGO_UPLOAD_DIR = path.join(__dirname, '../public/uploads/logos');
fs.mkdirSync(LOGO_UPLOAD_DIR, { recursive: true });

const _logoRaw = multer({
    storage: multer.diskStorage({
        destination: (_req, _file, cb) => cb(null, LOGO_UPLOAD_DIR),
        filename: (req, file, cb) => {
            const ext  = path.extname(file.originalname).toLowerCase();
            const uid  = req.session.userId ?? 'unknown';
            const rand = crypto.randomBytes(6).toString('hex');
            cb(null, `logo_${uid}_${Date.now()}_${rand}${ext}`);
        }
    }),
    fileFilter,
    limits: { fileSize: 5 * 1024 * 1024 }
});

const handleLogoUpload = (req, res, next) => {
    _logoRaw.single('logo')(req, res, (err) => {
        if (err) {
            req.uploadError = err.code === 'LIMIT_FILE_SIZE'
                ? 'Logo must be 5 MB or smaller.'
                : err.message || 'Invalid file. Only JPEG, PNG, and WebP are accepted.';
        }
        next();
    });
};

module.exports = { handleProfileUpload, handleLogoUpload };
