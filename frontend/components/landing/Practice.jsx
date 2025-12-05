'use client'
import { useState, useRef, useEffect } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { motion } from "framer-motion";
import { useInView } from "framer-motion";
import BASE_URL from '@/app/config/url' // added import for fetching

const Practice = () => {
	const [currentIndex, setCurrentIndex] = useState(0);
	const [isDragging, setIsDragging] = useState(false);
	const [startX, setStartX] = useState(0);
	const [translateX, setTranslateX] = useState(0);
	const [isTransitioning, setIsTransitioning] = useState(true);
	const [cardsPerView, setCardsPerView] = useState(3.5);
	const sliderRef = useRef(null);
	const sectionRef = useRef(null);
	const isInView = useInView(sectionRef, { once: true, margin: "-100px" });

	// dynamic articles fetched from backend
	const [articles, setArticles] = useState([]);
	const [loading, setLoading] = useState(true); // reuse loading for fetch state

	// Create infinite loop by duplicating fetched articles
	const extendedCards = [...articles, ...articles, ...articles];
	const totalCards = articles.length;

	// Handle responsive cards per view
	useEffect(() => {
		const handleResize = () => {
			if (window.innerWidth >= 1024) {
				setCardsPerView(3.5);
			} else {
				setCardsPerView(2.5);
			}
		};

		handleResize();
		window.addEventListener('resize', handleResize);
		return () => window.removeEventListener('resize', handleResize);
	}, []);

	// Start from middle set to enable infinite scrolling once articles loaded
	useEffect(() => {
		if (totalCards > 0) setCurrentIndex(totalCards);
	}, [totalCards]);

	// fetch daily featured resources (3 from each: blogs, stories, videos, audios)
	useEffect(() => {
		let mounted = true;
		const fetchArticles = async () => {
			setLoading(true);
			try {
				const res = await fetch(`${BASE_URL}/api/esl-resources/daily-featured`, { credentials: 'include' });
				if (!res.ok) {
					console.error('Failed to fetch daily featured resources', res.status);
					if (mounted) setArticles([]);
					return;
				}
				const data = await res.json();
				// Expect data.success && data.data (array of mixed resources)
				const items = data?.data || [];
				if (mounted) setArticles(Array.isArray(items) ? items : []);
			} catch (err) {
				console.error('Error fetching daily featured resources:', err);
				if (mounted) setArticles([]);
			} finally {
				if (mounted) setLoading(false);
			}
		};
		fetchArticles();
		return () => { mounted = false; };
	}, []);

	const handleNext = () => {
		setIsTransitioning(true);
		setCurrentIndex((prev) => prev + 1);
	};

	const handlePrev = () => {
		setIsTransitioning(true);
		setCurrentIndex((prev) => prev - 1);
	};

	// Reset to middle when reaching boundaries (creates infinite loop effect)
	useEffect(() => {
		if (currentIndex >= totalCards * 2) {
			setTimeout(() => {
				setIsTransitioning(false);
				setCurrentIndex(totalCards);
			}, 300);
		} else if (currentIndex <= 0) {
			setTimeout(() => {
				setIsTransitioning(false);
				setCurrentIndex(totalCards);
			}, 300);
		}
	}, [currentIndex, totalCards]);

	// Touch/Mouse handlers for mobile swipe
	const handleDragStart = (e) => {
		setIsDragging(true);
		setStartX(e.type === 'mousedown' ? e.pageX : e.touches[0].pageX);
	};

	const handleDragMove = (e) => {
		if (!isDragging) return;
		const currentX = e.type === 'mousemove' ? e.pageX : e.touches[0].pageX;
		const diff = currentX - startX;
		setTranslateX(diff);
	};

	const handleDragEnd = () => {
		if (!isDragging) return;
		setIsDragging(false);

		if (translateX > 50) {
			handlePrev();
		} else if (translateX < -50) {
			handleNext();
		}

		setTranslateX(0);
	};

	const truncateText = (text, maxLength = 100) => {
		if (text?.length <= maxLength) return text;
		return text?.slice(0, maxLength) + '...';
	};

	return (
		<section className="py-16 px-4 sm:px-6 lg:px-8 bg-background" ref={sectionRef}>
			<div className="max-w-7xl mx-auto">
				{/* Title */}
				<motion.h2
					initial={{ opacity: 0 }}
					animate={isInView ? { opacity: 1 } : { opacity: 0 }}
					transition={{ duration: 0.6, delay: 0.3 }}
					className="text-3xl sm:text-4xl lg:text-5xl font-bold text-center mb-12 text-foreground"
				>
					Practice anytime with our free resources
				</motion.h2>

				{/* Slider Container */}
				<div className="relative md:px-16">
					{/* Left Button */}
					<Button
						size="icon"
						className="absolute max-md:hidden left-2 md:-left-2 top-1/2 -translate-y-1/2 z-10 rounded-full shadow-lg bg-primary/70 md:bg-primary text-primary-foreground w-10 h-10 sm:w-12 sm:h-12 md:w-14 md:h-14"
						onClick={handlePrev}
					>
						<ChevronLeft className="h-5 w-5 sm:h-6 sm:w-6 md:h-7 md:w-7" />
					</Button>

					{/* Cards Container */}
					<div
						ref={sliderRef}
						className="overflow-hidden  active:cursor-grabbing"
						onMouseDown={handleDragStart}
						onMouseMove={handleDragMove}
						onMouseUp={handleDragEnd}
						onMouseLeave={handleDragEnd}
						onTouchStart={handleDragStart}
						onTouchMove={handleDragMove}
						onTouchEnd={handleDragEnd}
					>
						<div
							className={`flex ${isTransitioning ? 'transition-transform duration-300 ease-out' : ''}`}
							style={{
								transform: `translateX(calc(-${currentIndex * (100 / cardsPerView)}% + ${translateX}px))`,
							}}
						>
							{loading ? (
								// show skeleton placeholders same count as desired fetch limit
								Array.from({ length: 6 }).map((_, idx) => (
									<div key={`skel-${idx}`} className="flex-shrink-0 px-2 sm:px-3" style={{ width: `${100 / cardsPerView}%` }}>
										<div className="bg-card rounded-lg overflow-hidden shadow-md h-full border border-border animate-pulse" style={{height: '220px'}} />
									</div>
								))
							) : (
								extendedCards.map((item, index) => (
									<div key={`${item.id}-${item.resourceType}-${index}`} className="flex-shrink-0 px-2 sm:px-3" style={{ width: `${100 / cardsPerView}%` }}>
										<Link href={item.link || `/esl-resources/blogs/${item.id}`}>
											<div className="bg-card rounded-lg overflow-hidden shadow-md hover:shadow-xl transition-shadow duration-300 h-full border border-border">
												{/* Image */}
												<div className="aspect-video overflow-hidden">
													<img
														src={item.imageRef || item.imageUrl || 'https://images.unsplash.com/photo-1456513080510-7bf3a84b82f8?w=800&q=80'}
														alt={item.title}
														className="w-full h-full object-cover"
														draggable="false"
													/>
												</div>

												{/* Content */}
												<div className="p-4 sm:p-5">
													<h3 className="text-lg sm:text-xl font-semibold mb-2 text-foreground line-clamp-2">
														{item.title}
													</h3>
													<p className="text-sm sm:text-base text-muted-foreground">
														{truncateText(item.description, 80)}
													</p>
												</div>
											</div>
										</Link>
									</div>
								))
							)}
						</div>
					</div>

					{/* Right Button */}
					<Button
						size="icon"
						className="absolute max-md:hidden right-2 md:-right-2 top-1/2 -translate-y-1/2 z-10 rounded-full shadow-lg bg-primary/70 md:bg-primary text-primary-foreground w-10 h-10 sm:w-12 sm:h-12 md:w-14 md:h-14"
						onClick={handleNext}
					>
						<ChevronRight className="h-5 w-5 sm:h-6 sm:w-6 md:h-7 md:w-7" />
					</Button>
				</div>

				{/* All Resources Button */}
				<div className="flex justify-center mt-12">
					<motion.div
						initial={{ opacity: 0 }}
						animate={isInView ? { opacity: 1 } : { opacity: 0 }}
						transition={{ duration: 0.6, delay: 0.2 }}
					>
						<Link href="/esl-resources">
							<Button
								size="lg"
								className="bg-primary hover:bg-primary/90 text-primary-foreground px-8 py-6 text-base sm:text-lg font-semibold rounded-lg shadow-md hover:shadow-lg transition-all"
							>
								All Resources
							</Button>
						</Link>
					</motion.div>
				</div>
			</div>
		</section>
	);
};

export default Practice;
