const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const ALL_SPECIALIZATIONS = [
  'Digital Art', 'Traditional Art', 'Painting', 'Illustration', 'Photography',
  'Sculpture', 'Crafts', 'Textile Art', 'Mixed Media', 'Calligraphy'
];

const artistSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 120 },
    firstName: { type: String, trim: true, maxlength: 60, default: '' },
    lastName: { type: String, trim: true, maxlength: 80, default: '' },
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
    supabaseUserId: { type: String, sparse: true, unique: true, select: false },
    specializations: {
      type: [{ type: String, enum: ALL_SPECIALIZATIONS }],
      default: [],
    },
    bio: { type: String, trim: true, maxlength: 600, default: '' },

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
  const salt = await bcrypt.genSalt(10);
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
    email: this.email,
    role: this.role,
    specializations: this.specializations,
    bio: this.bio,
  };
};

module.exports = mongoose.model('Artist', artistSchema);
module.exports.ALL_SPECIALIZATIONS = ALL_SPECIALIZATIONS;
