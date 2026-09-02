require('dotenv').config();
const mongoose = require('mongoose');
const connectDB = require('../config/db');
const Artist = require('../models/Artist');
const Artwork = require('../models/Artwork');
const Exhibit = require('../models/Exhibit');

const ARTISTS = [
  { name: 'Juan Dela Cruz', email: 'juan@artvault.com', password: 'artist123', role: 'artist', specializations: ['Digital Art', 'Illustration', 'Mixed Media'], bio: 'Visual artist specializing in digital illustrations and layered mixed-media pieces.' },
  { name: 'Rosario Bautista', email: 'rosario@artvault.com', password: 'artist123', role: 'artist', specializations: ['Textile Art', 'Crafts'], bio: 'Weaver and dye artist working with natural fiber and traditional loom techniques.' },
  { name: 'Miguel Santos', email: 'miguel@artvault.com', password: 'artist123', role: 'artist', specializations: ['Photography', 'Sculpture'], bio: 'Documents everyday life through photography, and sculpts found materials into new forms.' },
  { name: 'Gallery Admin', email: 'admin@artvault.com', password: 'admin123', role: 'admin', specializations: [], bio: 'Curates exhibits and manages platform content.' },
];

async function seed() {
  await connectDB();

  console.log('Clearing existing data...');
  await Promise.all([Artist.deleteMany({}), Artwork.deleteMany({}), Exhibit.deleteMany({})]);

  console.log('Creating artists...');
  const createdArtists = {};
  for (const a of ARTISTS) {
    const artist = await Artist.create(a); // password hashed by the model's pre-save hook
    createdArtists[a.email] = artist;
  }

  const juan = createdArtists['juan@artvault.com'];
  const rosario = createdArtists['rosario@artvault.com'];
  const miguel = createdArtists['miguel@artvault.com'];

  console.log('Creating artworks...');
  const artworks = await Artwork.insertMany([
    { title: 'Sunset Dreams', artist: juan._id, categories: ['Digital Art', 'Illustration'], materials: ['Photoshop', 'Drawing Tablet'], description: 'A digital illustration exploring warm gradients over a quiet coastal skyline.' },
    { title: 'Duckling Study', artist: juan._id, categories: ['Digital Art', 'Mixed Media'], materials: ['Procreate', 'Paper texture overlay'], description: 'A soft character study blending digital brushwork with scanned paper grain.' },
    { title: 'Woven Horizon', artist: rosario._id, categories: ['Textile Art', 'Crafts'], materials: ['Cotton thread', 'Natural dye'], description: 'A hand-loomed wall hanging using gradient dye techniques.' },
    { title: 'Loom Fragments', artist: rosario._id, categories: ['Textile Art'], materials: ['Wool', 'Reclaimed frame'], description: 'Off-cuts from a larger weaving project, reassembled into a standalone piece.' },
    { title: 'Still Light', artist: miguel._id, categories: ['Photography'], materials: ['35mm film'], description: 'A quiet study of morning light through a market stall, shot on expired film.' },
    { title: 'Formed Clay', artist: miguel._id, categories: ['Sculpture', 'Mixed Media'], materials: ['Reclaimed clay', 'Wire'], description: 'A figure built from reclaimed clay and wire.' },
  ]);

  console.log('Creating exhibits...');
  await Exhibit.insertMany([
    {
      name: 'Modern Art Showcase',
      description: 'An annual mixed-discipline exhibit spanning digital, photographic, and sculptural work.',
      event_date: new Date('2026-10-20'),
      artworks: [artworks[0]._id, artworks[4]._id, artworks[5]._id],
    },
    {
      name: 'Handwoven & Handmade',
      description: 'A textile and craft-focused exhibit celebrating traditional material techniques.',
      event_date: new Date('2026-11-08'),
      artworks: [artworks[2]._id, artworks[3]._id],
    },
  ]);

  console.log('Seed complete. Demo logins:');
  console.log('  Artist:  juan@artvault.com / artist123');
  console.log('  Admin:   admin@artvault.com / admin123');

  await mongoose.disconnect();
  process.exit(0);
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
