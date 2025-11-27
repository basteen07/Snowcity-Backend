const express = require('express');
const router = express.Router();

// Mock Instagram data for now - replace with actual Instagram API integration
const getMockInstagramPosts = (username = 'snowcitybangalore', limit = 12) => {
  return {
    posts: [
      {
        id: '1',
        thumbnail_url: 'https://picsum.photos/300/300?random=1',
        media_url: 'https://picsum.photos/300/300?random=1',
        like_count: 150,
        comments_count: 25,
        permalink: 'https://instagram.com/p/1'
      },
      {
        id: '2',
        thumbnail_url: 'https://picsum.photos/300/300?random=2',
        media_url: 'https://picsum.photos/300/300?random=2',
        like_count: 200,
        comments_count: 30,
        permalink: 'https://instagram.com/p/2'
      },
      {
        id: '3',
        thumbnail_url: 'https://picsum.photos/300/300?random=3',
        media_url: 'https://picsum.photos/300/300?random=3',
        like_count: 180,
        comments_count: 22,
        permalink: 'https://instagram.com/p/3'
      },
      {
        id: '4',
        thumbnail_url: 'https://picsum.photos/300/300?random=4',
        media_url: 'https://picsum.photos/300/300?random=4',
        like_count: 220,
        comments_count: 35,
        permalink: 'https://instagram.com/p/4'
      },
      {
        id: '5',
        thumbnail_url: 'https://picsum.photos/300/300?random=5',
        media_url: 'https://picsum.photos/300/300?random=5',
        like_count: 165,
        comments_count: 28,
        permalink: 'https://instagram.com/p/5'
      },
      {
        id: '6',
        thumbnail_url: 'https://picsum.photos/300/300?random=6',
        media_url: 'https://picsum.photos/300/300?random=6',
        like_count: 195,
        comments_count: 31,
        permalink: 'https://instagram.com/p/6'
      },
      {
        id: '7',
        thumbnail_url: 'https://picsum.photos/300/300?random=7',
        media_url: 'https://picsum.photos/300/300?random=7',
        like_count: 210,
        comments_count: 33,
        permalink: 'https://instagram.com/p/7'
      },
      {
        id: '8',
        thumbnail_url: 'https://picsum.photos/300/300?random=8',
        media_url: 'https://picsum.photos/300/300?random=8',
        like_count: 175,
        comments_count: 26,
        permalink: 'https://instagram.com/p/8'
      },
      {
        id: '9',
        thumbnail_url: 'https://picsum.photos/300/300?random=9',
        media_url: 'https://picsum.photos/300/300?random=9',
        like_count: 190,
        comments_count: 29,
        permalink: 'https://instagram.com/p/9'
      },
      {
        id: '10',
        thumbnail_url: 'https://picsum.photos/300/300?random=10',
        media_url: 'https://picsum.photos/300/300?random=10',
        like_count: 205,
        comments_count: 32,
        permalink: 'https://instagram.com/p/10'
      },
      {
        id: '11',
        thumbnail_url: 'https://picsum.photos/300/300?random=11',
        media_url: 'https://picsum.photos/300/300?random=11',
        like_count: 185,
        comments_count: 27,
        permalink: 'https://instagram.com/p/11'
      },
      {
        id: '12',
        thumbnail_url: 'https://picsum.photos/300/300?random=12',
        media_url: 'https://picsum.photos/300/300?random=12',
        like_count: 215,
        comments_count: 34,
        permalink: 'https://instagram.com/p/12'
      }
    ].slice(0, limit)
  };
};

// GET /api/social/instagram
router.get('/instagram', async (req, res) => {
  try {
    const { username = 'snowcitybangalore', limit = 12 } = req.query;
    
    // For now, return mock data
    // TODO: Implement actual Instagram Basic Display API integration
    const mockData = getMockInstagramPosts(username, parseInt(limit));
    
    res.json(mockData);
  } catch (error) {
    console.error('Instagram API error:', error);
    res.status(500).json({ 
      error: 'Failed to fetch Instagram data',
      message: error.message 
    });
  }
});

module.exports = router;
