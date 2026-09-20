const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const BCRYPT_ROUNDS = 12;

const ALL_SPECIALIZATIONS = [
  'Digital Art', 'Traditional Art', 'Painting', 'Illustration', 'Photography',
  'Sculpture', 'Crafts', 'Textile Art', 'Mixed Media', 'Calligraphy'
];

const artistSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 120 },
    firstName: { type: String, trim: true, maxlength: 50, default: '' },
    lastName: { type: String, trim: true, maxlength: 50, default: '' },
    extensionName: { type: String, trim: true, maxlength: 10, default: '' },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'Enter a valid email address'],
    },
    password: { type: String, required: true, minlength: 6, select: false },
    role: { type: String, enum: ['artist', 'sub_admin', 'main_admin', 'admin'], default: 'artist' },
    status: { type: String, enum: ['active', 'suspended'], default: 'active', index: true },
    suspendedAt: { type: Date, default: null },
    supabaseUserId: { type: String, sparse: true, unique: true, select: false },
    emailConfirmedAt: { type: Date, default: null },
    specializations: {
      type: [{ type: String, enum: ALL_SPECIALIZATIONS }],
      default: [],
    },
    bio: { type: String, trim: true, maxlength: 50, default: '' },
    avatar_path: { type: String, trim: true, default: '' },

    // STEP 2 of the login flowchart — rate limiting / lockout
    failedLoginAttempts: { type: Number, default: 0 },
    lockUntil: { type: Date, default: null },
  },
  { timestamps: true }
);

artistSchema.index({ specializations: 1 });
artistSchema.index({ createdAt: -1 });

// STEP 1 of the login flowchart — hash the password (bcrypt) before it ever touches the DB
artistSchema.pre('save', async function hashPassword(next) {
  if (!this.isModified('password')) return next();
  const salt = await bcrypt.genSalt(BCRYPT_ROUNDS);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

artistSchema.methods.comparePassword = function comparePassword(candidate) {
  return bcrypt.compare(candidate, this.password);
};

artistSchema.virtual('isLocked').get(function isLocked() {
  return !!(this.lockUntil && this.lockUntil > Date.now());
});

artistSchema.methods.toSafeObject = function toSafeObject() {
  return {
    id: this._id,
    name: this.name,
    firstName: this.firstName || '',
    lastName: this.lastName || '',
    email: this.email,
    role: this.role,
    status: this.status,
    specializations: this.specializations,
    bio: this.bio,
    avatar_path: this.avatar_path || '',
  };
};

module.exports = mongoose.model('Artist', artistSchema);
module.exports.ALL_SPECIALIZATIONS = ALL_SPECIALIZATIONS;
