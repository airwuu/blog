import React from 'react';
import md5 from 'js-md5'; // A client-side library for MD5 hashing.
import AvatarComponent from '@/components/ui/avatar'; // Assuming this is a React component
import { cn } from '@/lib/utils'; // Assuming this is a React-compatible utility

// This function now uses a browser-compatible MD5 library.
function createGravatarUrl(email) {
  if (!email) return '';
  const lowerCaseEmail = email.trim().toLowerCase();
  const hashHex = md5(lowerCaseEmail);
  return `https://www.gravatar.com/avatar/${hashHex}?d=identicon`;
}

export function TimelinePostCard({ post }) {
  const { name, email, content, created_at } = post;
  const gravatarUrl = createGravatarUrl(email);

  return (
    <div className="bg-primary-foreground/50 backdrop-blur-sm overflow-hidden rounded-xl border p-4 transition-colors duration-300 ease-in-out">
      <div className="flex flex-wrap gap-4">
        <AvatarComponent
          src={gravatarUrl}
          alt={`Avatar of ${name}`}
          fallback={name[0]}
          className={cn(
            'size-24 rounded-md [&>[data-slot="avatar-fallback"]]:rounded-md',
            'hover:ring-primary transition-shadow duration-300 hover:cursor-pointer hover:ring-2',
          )}
        />
        <div className="flex grow flex-col justify-between gap-y-2">
          <div>
            <div className="flex flex-wrap items-center justify-between gap-x-2">
              <h3 className="text-lg font-medium">{name}</h3>
              <span className="text-muted-foreground text-sm">
                ({new Date(created_at).toLocaleString()})
              </span>
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-300 mb-2">{email}</p>
            <p className="text-gray-800 dark:text-gray-200 whitespace-pre-wrap">{content}</p>
          </div>
        </div>
      </div>
    </div>
  );
}