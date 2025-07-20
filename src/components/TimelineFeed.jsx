import React, { useState, useEffect } from 'react';
import { TimelinePostCard } from './TimelinePostCard';

const API_URL = 'http://mlhportfolio-aaron.duckdns.org:5000/api/timeline_post';

export function TimelineFeed() {
  const [posts, setPosts] = useState([]);
  const [status, setStatus] = useState('loading');

  useEffect(() => {
    async function fetchPosts() {
      try {
        const response = await fetch(API_URL);
        if (!response.ok) {
          throw new Error(`HTTP error! Status: ${response.status}`);
        }
        const data = await response.json();
        setPosts(data.timeline_posts || []);
        setStatus('success');
      } catch (error) {
        console.error("Failed to fetch timeline posts:", error);
        setStatus('error');
      }
    }
    fetchPosts();
  }, []); 

  if (status === 'loading') {
    return <p>Loading posts...</p>;
  }

  if (status === 'error') {
    return <p>Could not load timeline posts. Try refreshing the page.</p>;
  }

  return (
    <div className="flex flex-col gap-4">
      {posts.length > 0 ? (
        posts.map(post => <TimelinePostCard key={post.id} post={post} />)
      ) : (
        <p>No posts yet.</p>
      )}
    </div>
  );
}